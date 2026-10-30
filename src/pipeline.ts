/**
 * @fileoverview 构造、导出和独立重载的执行管线；全部门禁及资源关闭通过后才提交交付。
 */

import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {auditGgb, assertCapabilities, readDelivery} from './delivery.js';
import {EngineSession} from './browser.js';
import {runtimeIdentity, sha256} from './runtime.js';
import {ToolError} from './errors.js';
import {
  compareReload,
  summarizeRequirements,
  verifyRequest,
  type Facts,
} from './verify.js';
import {
  DRAG_HIT_RADIUS_PX,
  evaluateDrag,
  nearbyPoints,
  toPixels,
  type DragEvidence,
} from './interaction.js';
import type {Request} from './request.js';

/**
 * 在独立暂存区执行真实引擎流程；清理和完整性门禁后才提交成功目录。
 * @param command doctor 只验证真实就绪，build 执行声明请求的完整构图链路。
 * @param root 工具自身安装根，用于定位固定运行时和 viewer。
 * @param request doctor 不传；build 必须传入经过 readRequest 验证的请求。
 * @param outputRoot 用户工作区输出根；默认调用方 cwd/output，绝不写安装包。
 */
export async function runTool(
  command: 'doctor' | 'build',
  root: string,
  request?: Request,
  outputRoot = join(process.cwd(), 'output'),
) {
  const base = outputRoot;
  await mkdir(base, {recursive: true});
  // 暂存区即使含 GGB 也不是交付；任何失败都保留在该隔离目录。
  const directory = await mkdtemp(join(base, `.${command}-`));
  function save(name: string, data: unknown) {
    return writeFile(
      join(directory, name),
      JSON.stringify(data, null, 2) + '\n',
    );
  }
  const session = new EngineSession(root);
  let stage = 'runtime';
  let error: unknown;
  let identity: Awaited<ReturnType<typeof runtimeIdentity>> | undefined;
  let cleanup: Awaited<ReturnType<EngineSession['close']>> | undefined;
  const reports: {
    phase: string;
    checks: {id: string; requirement: string; status: string}[];
  }[] = [];
  /** 先保存事实、XML 和截图，再判定版本，保证失败仍有原始观察可追溯。 */
  async function capture(name: string) {
    const facts = await session.snapshot();
    await save(`${name}.json`, facts);
    await writeFile(join(directory, `${name}.xml`), await session.xml());
    await session.page!.screenshot({
      path: join(directory, `${name}.png`),
      fullPage: true,
    });
    if (facts.engineVersion !== identity!.version) {
      throw new ToolError(
        'RUNTIME_UNAVAILABLE',
        'Actual engine version mismatch',
      );
    }
    return facts;
  }
  function verify(facts: Facts, phase: string) {
    const report = {phase, ...verifyRequest(request!, facts)};
    reports.push(report);
    return report.ok;
  }
  try {
    // 请求和交互占位先落盘；即使后续失败，也不能删除要求或伪装成已验证。
    if (request) {
      await save('request.json', request);
      stage = 'capabilities';
      assertCapabilities(request);
    }
    identity = await runtimeIdentity(root);
    await save('runtime.json', identity);
    await copyFile(
      join(root, '.runtime/README.txt'),
      join(directory, 'runtime-README.txt'),
    );
    await copyFile(
      join(root, '.runtime-download/geogebra-license.html'),
      join(directory, 'geogebra-license.html'),
    );
    if (request) {
      await save('request.json', request);
    }
    stage = 'launch';
    await session.launch();
    await save('environment.json', {
      node: process.version,
      browser: session.browser!.version(),
      browserSelection: session.browserSelection,
      origin: session.local!.origin,
    });
    stage = 'engine-ready';
    await session.freshApplet();
    const empty = await capture(stage);
    if (command === 'doctor') {
      // 大写标签使坐标赋值构造点；小写标签可能被原生引擎解释为向量。
      stage = 'native-smoke';
      await session.page!.evaluate(
        'if (!window.engine.evalCommand("DoctorPoint=(1,2)")) throw new Error("Native smoke failed")',
      );
      const smoke = await capture(stage);
      const point = smoke.objects.find(o => o.label === 'DoctorPoint');
      if (
        !point?.defined ||
        point.type !== 'point' ||
        JSON.stringify(point.coordinates) !== '[1,2]'
      ) {
        throw new ToolError('ENGINE_ERROR', 'Native smoke facts differ');
      }
    } else {
      stage = 'construction';
      await session.run(request!);
      const before = await capture('constructed');
      stage = 'initial-verification';
      const initialOK = verify(before, 'initial');
      const interactionPlaceholder = (reason: string) =>
        request!.interactions.map(sample => ({
          id: sample.id,
          requirement: sample.requirement,
          kind: sample.kind,
          label: sample.label,
          status: 'unverified',
          reasons: [reason],
        }));
      await save('verification.json', {
        scope: 'declared-request',
        status: initialOK ? 'passed' : 'failed',
        reports,
        interactions: interactionPlaceholder(
          initialOK
            ? 'interaction verification was not reached'
            : 'initial verification failed',
        ),
        mouseInteraction: request!.interactions.length
          ? 'requested-not-verified'
          : 'not-requested',
      });
      if (
        !initialOK ||
        JSON.stringify(before.scripts) !== JSON.stringify(empty.scripts)
      ) {
        throw new ToolError(
          'VERIFICATION_FAILED',
          'Initial conditions or script audit failed',
        );
      }
      stage = 'export';
      // 文件字节只能来自真实引擎导出；ZIP 检查不是数学核验的替代。
      const bytes = Buffer.from(await session.exportGgb(), 'base64');
      if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        throw new ToolError(
          'ENGINE_ERROR',
          'Engine did not export a ZIP-format GGB',
        );
      }
      await writeFile(join(directory, 'construction.ggb'), bytes);
      auditGgb(join(directory, 'construction.ggb'));
      await capture('exported');
      // 必须丢弃原上下文，并证明新 applet 为空，才进入独立重载。
      stage = 'reload-empty';
      await session.freshApplet();
      await capture(stage);
      stage = 'reload';
      // 重新读取磁盘文件，不能复用刚导出的 base64 变量冒充文件重载。
      await session.loadGgb(
        (await readFile(join(directory, 'construction.ggb'))).toString(
          'base64',
        ),
      );
      const reloaded = await capture('reloaded');
      stage = 'reload-verification';
      const reloadedOK = verify(reloaded, 'reloaded');
      const contentEqual = compareReload(before, reloaded);
      await save('verification.json', {
        scope: 'declared-request',
        status: reloadedOK && contentEqual ? 'passed' : 'failed',
        reports,
        contentEqual,
        interactions: interactionPlaceholder(
          reloadedOK && contentEqual
            ? 'interaction verification was not reached'
            : 'reload verification failed',
        ),
        mouseInteraction: request!.interactions.length
          ? 'requested-not-verified'
          : 'not-requested',
      });
      if (!reloadedOK || !contentEqual) {
        throw new ToolError(
          'VERIFICATION_FAILED',
          'Reload conditions or content comparison failed',
        );
      }
      // 每个交互样本都关闭上一上下文、验证新 applet 为空，并重新读取磁盘 GGB。
      const ggbSource = await readFile(join(directory, 'construction.ggb'));
      const ggbSourceSha = sha256(ggbSource);
      const interactionReports: ReturnType<typeof evaluateDrag>[] = [];
      for (const sample of request!.interactions) {
        const tag = `interaction-${sample.id}`;
        stage = `${tag}-empty`;
        await session.freshApplet();
        const emptyApplet = await capture(`${tag}-empty`);
        if (emptyApplet.objects.length !== 0) {
          throw new ToolError(
            'ENGINE_ERROR',
            'Interaction applet was not empty before loading',
          );
        }
        stage = `${tag}-load`;
        const sampleBytes = await readFile(join(directory, 'construction.ggb'));
        const sampleSha = sha256(sampleBytes);
        if (sampleSha !== ggbSourceSha) {
          throw new ToolError(
            'VERIFICATION_FAILED',
            'Interaction source changed during execution',
          );
        }
        await session.loadGgb(sampleBytes.toString('base64'));
        const dragBefore = await capture(`${tag}-before`);
        const viewBefore = await session.viewProperties();
        const visible = await session.visible(sample.label);
        const beforePoint = dragBefore.objects.find(
          object => object.label === sample.label,
        );
        if (
          !beforePoint?.coordinates ||
          beforePoint.coordinates.some(value => !Number.isFinite(value))
        ) {
          throw new ToolError(
            'VERIFICATION_FAILED',
            `Interaction ${sample.id} has no finite drag point`,
          );
        }
        const start = toPixels(beforePoint.coordinates, viewBefore);
        const target = toPixels(sample.to, viewBefore);
        const startCandidates = nearbyPoints(
          dragBefore,
          viewBefore,
          start,
          sample.label,
        );
        const targetCandidates = nearbyPoints(
          dragBefore,
          viewBefore,
          target,
          sample.label,
        );
        stage = `${tag}-drag`;
        const mouse = await session.drag(start, target, 24);
        const dragAfter = await capture(`${tag}-after`);
        const viewAfter = await session.viewProperties();
        const sampleContentEqual = compareReload(reloaded, dragBefore);
        const evidence: DragEvidence = {
          source: {
            file: 'construction.ggb',
            sha256: sampleSha,
            freshContextEmptyCount: emptyApplet.objects.length,
            reloadedContentEqual: sampleContentEqual,
          },
          pointer: {
            start,
            target,
            steps: mouse.steps,
            down: mouse.down,
            up: mouse.up,
            hitRadiusPx: DRAG_HIT_RADIUS_PX,
            startCandidates,
            targetCandidates,
          },
          viewBefore,
          viewAfter,
          visible,
          screenshots: {
            before: `${tag}-before.png`,
            after: `${tag}-after.png`,
          },
        };
        const report = evaluateDrag(
          request!,
          sample,
          dragBefore,
          dragAfter,
          evidence,
        );
        interactionReports.push(report);
        await save('verification.json', {
          scope: 'declared-request',
          status: report.status === 'passed' ? 'passed' : 'failed',
          reports,
          contentEqual,
          interactions: interactionReports,
          mouseInteraction: 'requested-not-verified',
        });
      }
      const interactionsOK =
        interactionReports.length === request!.interactions.length &&
        interactionReports.every(report => report.status === 'passed');
      const requirements = summarizeRequirements(
        request!,
        reports,
        interactionReports,
      );
      const requirementsOK = requirements.every(
        requirement => requirement.status === 'passed',
      );
      await save('verification.json', {
        scope: 'declared-request',
        status:
          reloadedOK && contentEqual && interactionsOK && requirementsOK
            ? 'passed'
            : 'failed',
        reports,
        requirements,
        contentEqual,
        interactions: interactionReports,
        mouseInteraction: request!.interactions.length
          ? interactionsOK
            ? 'verified'
            : 'failed'
          : 'not-requested',
        limitations: [
          'A finite set of initial, reload and mouse-drag samples is not a general mathematical proof.',
          'The mouse gate verifies the declared samples only; it does not prove all possible drags or all geometry problems.',
        ],
      });
      if (!interactionsOK || !requirementsOK) {
        throw new ToolError(
          'VERIFICATION_FAILED',
          'Mouse interaction samples or requirement summary failed',
        );
      }
      await copyFile(
        join(directory, 'reloaded.png'),
        join(directory, 'preview.png'),
      );
    }
    if (session.blocked.length) {
      throw new ToolError(
        'ENGINE_ERROR',
        'Engine attempted a non-local resource request',
      );
    }
  } catch (failure) {
    const ioFailure =
      failure instanceof Error &&
      'code' in failure &&
      ['EACCES', 'ENOSPC', 'EIO', 'EROFS'].includes(String(failure.code));
    error =
      failure instanceof ToolError
        ? failure
        : new ToolError(
            ioFailure
              ? 'DELIVERY_ERROR'
              : stage === 'launch' || stage === 'engine-ready'
                ? 'RUNTIME_UNAVAILABLE'
                : 'ENGINE_ERROR',
            String(failure),
          );
    await save('failure.json', {stage, error: String(error)});
    if (session.page && !session.page.isClosed()) {
      await session.page
        .screenshot({path: join(directory, 'failure.png'), fullPage: true})
        .catch(e => session.log.push(String(e)));
    }
  } finally {
    // 关闭失败也会阻止后续提交，不能把资源回收当作成功之后的附带操作。
    cleanup = await session.close();
    await save('cleanup.json', cleanup);
    await save('browser-log.json', session.log);
    await save('requests.json', {
      local: session.local?.requests ?? [],
      blocked: session.blocked,
    });
  }
  if (!cleanup.ok) {
    error = new ToolError(
      'CLEANUP_FAILED',
      'Execution resources could not all be closed',
    );
  }
  if (error) {
    const failed = error as ToolError;
    await save('result.json', {
      ok: false,
      stage,
      code: failed.code,
      scope: 'diagnostics-only',
    });
    throw new ToolError(failed.code, failed.message, directory);
  }
  // 只有全部声明要求和资源关闭均通过，才进入正式交付提交阶段。
  try {
    const hashes: Record<string, string> = {};
    // 清单最后写入且不包含自身摘要，避免循环定义文件身份。
    for (const file of await readdir(directory)) {
      hashes[file] = sha256(await readFile(join(directory, file)));
    }
    const version = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    ).version as string;
    await save('manifest.json', {
      schemaVersion: 2,
      kind: command === 'build' ? 'delivery' : 'doctor-evidence',
      scope: 'declared-request',
      toolVersion: version,
      runtime: identity,
      ...(request
        ? {
            outputs: request.outputs,
            requestSha256: hashes['request.json'],
            ggbFile: 'construction.ggb',
          }
        : {}),
      files: hashes,
    });
    if (command === 'build') {
      // 使用消费者同样的完整性检查，避免构建方和预览方采用不同通过标准。
      await readDelivery(directory);
    }
    // 独占父目录内的新子路径让提交目标天然唯一，不按标题覆盖旧结果。
    const artifactDirectory =
      command === 'build'
        ? join(await mkdtemp(join(base, 'delivery-')), 'delivery')
        : join(base, basename(directory).slice(1));
    await rename(directory, artifactDirectory);
    return {
      scope: command === 'build' ? 'declared-request' : 'runtime-readiness',
      ...(command === 'build'
        ? {delivery: artifactDirectory}
        : {artifactDirectory}),
      runtime: identity,
      cleanup,
      ...(request ? {outputs: request.outputs} : {}),
    };
  } catch (failure) {
    throw new ToolError('DELIVERY_ERROR', String(failure), directory);
  }
}
