/**
 * @fileoverview 使用真实引擎验证交付、拒绝路径和预览退出，不能用模拟事实替代本测试。
 */

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  cp,
  appendFile,
  readdir,
  realpath,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {readDelivery} from '../src/delivery.js';
import {sha256} from '../src/runtime.js';
import {parseRequest} from '../src/request.js';
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
async function run(args: string[], cwd?: string, timeout = 120_000) {
  return new Promise<{status: number | null; stdout: string; stderr: string}>(
    (resolve, reject) => {
      const child = spawn(process.execPath, [cli, ...args], {
        timeout,
        ...(cwd ? {cwd} : {}),
      });
      let stdout = '',
        stderr = '';
      child.stdout.on('data', data => {
        stdout += String(data);
      });
      child.stderr.on('data', data => {
        stderr += String(data);
      });
      child.on('error', reject);
      child.on('close', status => resolve({status, stdout, stderr}));
    },
  );
}
await test(
  'real triangle, circle transfer and failed builds preserve cleanup evidence',
  {skip: process.env.GGB_INTEGRATION !== '1', timeout: 600_000},
  async () => {
    const temp = await mkdtemp(join(tmpdir(), 'ggb-demo-integration-'));
    const workspace = await realpath(temp);
    const packageOutput = join(packageRoot, 'output');
    const packageEntriesBefore = new Set(
      await readdir(packageOutput).catch(() => []),
    );
    try {
      const sample = JSON.parse(
        await readFile(
          new URL('../../examples/triangle-static.json', import.meta.url),
          'utf8',
        ),
      );
      const circle = {
        schemaVersion: 2,
        title: 'Circle transfer',
        source: 'Create circle with center O through P.',
        choices: ['O=(0,0), P=(3,0) are chosen.'],
        requirements: [
          {id: 'circle', description: 'Native circle with center O through P.'},
        ],
        program: [
          {label: 'O', expression: '(0,0)'},
          {label: 'P', expression: '(3,0)'},
          {label: 'ring', expression: 'Circle(O,P)'},
        ],
        styles: [],
        checks: [
          {
            id: 'center',
            requirement: 'circle',
            kind: 'object',
            label: 'O',
            type: 'point',
            parents: [],
          },
          {
            id: 'point',
            requirement: 'circle',
            kind: 'object',
            label: 'P',
            type: 'point',
            parents: [],
          },
          {
            id: 'ring',
            requirement: 'circle',
            kind: 'object',
            label: 'ring',
            type: 'circle',
            parents: ['O', 'P'],
          },
          {
            id: 'radius',
            requirement: 'circle',
            kind: 'boolean',
            expression: 'Radius(ring)>2',
          },
        ],
        outputs: ['O', 'P', 'ring'],
        interactions: [],
        view: [-5, 5, -4, 4],
      };
      const full = JSON.parse(
        await readFile(
          new URL('../../examples/triangle.json', import.meta.url),
          'utf8',
        ),
      );
      const sliderPolygon = JSON.parse(
        await readFile(
          new URL(
            '../../examples/circle-inscribed-polygon.json',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      // 达到 schema 上限，并覆盖下划线 id；每次拖动必须独立重载同一 GGB。
      const twentySamples = structuredClone(parseRequest(full));
      twentySamples.interactions = Array.from({length: 20}, (_, index) => ({
        ...twentySamples.interactions[0]!,
        id: `move_A_${index}`,
      }));
      // 与完整案例同形，但 M 是格式合法的静态点；初始数值正确，依赖不合格。
      const fullStatic = structuredClone(full);
      fullStatic.program.find(
        (s: {label: string}) => s.label === 'M',
      ).expression = '(3,0)';
      // 修复为真实中点后应重新通过完整门禁，证明反例不是容差问题。
      const repaired = structuredClone(fullStatic);
      repaired.program.find(
        (s: {label: string}) => s.label === 'M',
      ).expression = 'Midpoint(A,B)';
      // 语法合法且初态坐标正确的反例，必须由动态依赖门禁识别。
      const staticPoint = structuredClone(sample);
      staticPoint.program.find(
        (s: {label: string}) => s.label === 'M',
      ).expression = '(3,0)';
      // 原生命令名不在结构预检中枚举，未知命令应在真实引擎阶段失败。
      const badCommand = structuredClone(sample);
      badCommand.program.find(
        (s: {label: string}) => s.label === 'M',
      ).expression = 'NotARealGeoGebraCommand(A,B)';
      for (const [name, request, expected] of [
        ['triangle', sample, null],
        ['circle', circle, null],
        ['static-midpoint', staticPoint, 'VERIFICATION_FAILED'],
        ['invalid-native', badCommand, 'ENGINE_ERROR'],
        ['full-drag', full, null],
        ['full-static-midpoint', fullStatic, 'VERIFICATION_FAILED'],
        ['repaired-drag', repaired, null],
        ['slider-polygon', sliderPolygon, null],
        ['twenty-underscore-drags', twentySamples, null],
      ] as const) {
        const path = join(temp, `${name}.json`);
        await writeFile(path, JSON.stringify(request));
        const result = await run(
          ['build', '--request', path],
          temp,
          name === 'twenty-underscore-drags' ? 300_000 : 120_000,
        );
        const response = JSON.parse(expected ? result.stderr : result.stdout);
        assert.equal(result.status, expected ? 1 : 0, result.stderr);
        if (expected) {
          assert.equal(response.error.code, expected);
          assert.equal(result.stdout, '');
          const cleanup = JSON.parse(
            await readFile(
              join(response.error.diagnostics, 'cleanup.json'),
              'utf8',
            ),
          );
          assert.equal(cleanup.ok, true);
          if (name === 'full-static-midpoint') {
            const failedReport = JSON.parse(
              await readFile(
                join(response.error.diagnostics, 'verification.json'),
                'utf8',
              ),
            );
            const failedCheck = failedReport.reports
              .flatMap(
                (report: {checks: {id: string; status: string}[]}) =>
                  report.checks,
              )
              .find(
                (check: {id: string; status: string}) =>
                  check.id === 'midpoint',
              );
            assert.equal(failedCheck.status, 'failed');
            assert.equal(
              failedReport.mouseInteraction,
              'requested-not-verified',
            );
          }
        } else {
          const directory = response.result.delivery;
          assert.ok(directory.startsWith(join(workspace, 'output')));
          const report = JSON.parse(
            await readFile(join(directory, 'verification.json'), 'utf8'),
          );
          assert.equal(report.contentEqual, true);
          assert.equal(report.reports.length, 2);
          assert.ok(report.reports.every((r: {ok: boolean}) => r.ok));
          assert.ok(
            report.requirements.every(
              (requirement: {status: string}) =>
                requirement.status === 'passed',
            ),
          );
          assert.equal(response.result.cleanup.ok, true);
          await readDelivery(directory);
          if (name === 'twenty-underscore-drags') {
            assert.equal(report.mouseInteraction, 'verified');
            assert.equal(report.interactions.length, 20);
            assert.ok(
              report.interactions.every(
                (sample: {status: string}) => sample.status === 'passed',
              ),
            );
            const manifest = JSON.parse(
              await readFile(join(directory, 'manifest.json'), 'utf8'),
            ) as {files: Record<string, string>};
            assert.equal(Object.keys(manifest.files).length, 206);
            assert.ok(manifest.files['interaction-move_A_19-after.xml']);
            await assertMissingEvidenceRejected(directory, temp);
            // 对最大请求也执行真正的同文件预览，而不止读取报告。
            await previewAndClose(directory, temp);
          }
          if (name === 'slider-polygon') {
            const sides = report.reports[0].checks.find(
              (check: {id: string}) => check.id === 'sides',
            );
            assert.equal(sides.actual.slider.min, 3);
            assert.equal(sides.actual.slider.max, 12);
            assert.equal(sides.actual.slider.horizontal, true);
            assert.equal(report.reports[0].checks.length, 14);
            assert.equal(report.mouseInteraction, 'not-requested');
            const sampleAfter = JSON.parse(
              await readFile(join(directory, 'constructed.json'), 'utf8'),
            );
            const slider = sampleAfter.objects.find(
              (object: {label: string}) => object.label === 'n',
            );
            assert.deepEqual(slider.slider, {
              min: 3,
              max: 12,
              width: 200,
              horizontal: true,
              showAlgebra: true,
            });
          }
          if (name === 'full-drag' || name === 'repaired-drag') {
            assert.equal(report.mouseInteraction, 'verified');
            assert.equal(report.interactions.length, 1);
            assert.equal(report.interactions[0].status, 'passed');
            assert.deepEqual(report.interactions[0].after.coordinates, [-1, 1]);
            const sampleAfter = JSON.parse(
              await readFile(
                join(directory, 'interaction-moveA-after.json'),
                'utf8',
              ),
            );
            const moved = sampleAfter.objects.find(
              (o: {label: string}) => o.label === 'M',
            );
            assert.deepEqual(moved.coordinates, [2.5, 0.5]);
            assert.deepEqual(moved.parents, ['A', 'B']);
            const median = sampleAfter.objects.find(
              (o: {label: string}) => o.label === 'CM',
            );
            assert.deepEqual(median.parents, ['C', 'M']);
            for (const suffix of ['before', 'after']) {
              const screenshot = await readFile(
                join(directory, `interaction-moveA-${suffix}.png`),
              );
              assert.deepEqual(
                [...screenshot.subarray(0, 8)],
                [137, 80, 78, 71, 13, 10, 26, 10],
              );
            }
            // 测试内故障注入：篡改拖动后 M 的事实并同步清单摘要；
            // 交付验证必须从 JSON 事实重算依赖，不能只信任 passed 文本。
            const tamperedInteraction = join(temp, 'tampered-interaction');
            await cp(directory, tamperedInteraction, {recursive: true});
            const afterPath = join(
              tamperedInteraction,
              'interaction-moveA-after.json',
            );
            const afterFacts = JSON.parse(
              (await readFile(afterPath)).toString(),
            ) as {
              objects: {
                label: string;
                independent: boolean;
                parents: string[];
                coordinates: number[] | null;
              }[];
            };
            const staticM = afterFacts.objects.find(
              object => object.label === 'M',
            )!;
            staticM.independent = true;
            staticM.parents = [];
            staticM.coordinates = [3, 0];
            await writeFile(
              afterPath,
              JSON.stringify(afterFacts, null, 2) + '\n',
            );
            const manifestPath = join(tamperedInteraction, 'manifest.json');
            const manifest = JSON.parse(
              (await readFile(manifestPath)).toString(),
            ) as {files: Record<string, string>};
            manifest.files['interaction-moveA-after.json'] = sha256(
              await readFile(afterPath),
            );
            await writeFile(
              manifestPath,
              JSON.stringify(manifest, null, 2) + '\n',
            );
            await assert.rejects(
              readDelivery(tamperedInteraction),
              /Interaction evidence fails|Requirement summary fails/,
            );
          }
          if (name === 'triangle') {
            const tampered = join(temp, 'tampered');
            await cp(directory, tampered, {recursive: true});
            // 篡改真实交付的副本，验证摘要检查在启动预览前就能拒绝它。
            await appendFile(join(tampered, 'preview.png'), 'tampered');
            const rejected = await run(['preview', '--delivery', tampered]);
            assert.equal(rejected.status, 1);
            assert.equal(
              JSON.parse(rejected.stderr).error.code,
              'PREVIEW_ERROR',
            );
            await previewAndClose(directory, temp);
          }
          const bytes = await readFile(join(directory, 'construction.ggb'));
          assert.ok(bytes.length > 100);
        }
        console.log(`${name}: ${expected ?? 'constructed-and-reloaded'}`);
      }
      // 构建和预览只能写调用方 workspace，不能在安装包 output/ 新增结果。
      const packageEntriesAfter = await readdir(packageOutput).catch(() => []);
      assert.deepEqual(
        packageEntriesAfter.filter(
          (entry: string) => !packageEntriesBefore.has(entry),
        ),
        [],
      );
    } finally {
      // 保留本轮真实引擎证据及失败诊断；旧工作区和历史产物均不改写。
      console.log(`integration-workspace: ${workspace}`);
    }
  },
);

/** 删除真实交付副本中的每个必需文件，并同步清单，避免只测到摘要不符。 */
async function assertMissingEvidenceRejected(
  directory: string,
  workspace: string,
) {
  const copy = join(workspace, 'missing-evidence');
  await cp(directory, copy, {recursive: true});
  const manifestPath = join(copy, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    files: Record<string, string>;
  };
  try {
    for (const name of Object.keys(manifest.files)) {
      const path = join(copy, name);
      const bytes = await readFile(path);
      const digest = manifest.files[name]!;
      await rm(path);
      delete manifest.files[name];
      await writeFile(manifestPath, JSON.stringify(manifest));
      await assert.rejects(
        readDelivery(copy),
        /Missing required delivery file:/,
      );
      await writeFile(path, bytes);
      manifest.files[name] = digest;
    }
  } finally {
    // 故障注入目录不是交付证据；只删除这个新建副本。
    await rm(copy, {recursive: true, force: true});
  }
}

async function previewAndClose(directory: string, cwd?: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cli, 'preview', '--delivery', directory],
      {...(cwd ? {cwd} : {})},
    );
    let stdout = '',
      stderr = '',
      signalled = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Preview did not exit'));
    }, 90_000);
    child.stdout.on('data', data => {
      stdout += String(data);
      if (!signalled && stdout.includes('"event":"ready"')) {
        signalled = true;
        // 等待真正就绪再发信号，检验正常关闭，而不是只测试启动中取消。
        child.kill('SIGINT');
      }
    });
    child.stderr.on('data', data => {
      stderr += String(data);
    });
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', async status => {
      clearTimeout(timer);
      try {
        assert.equal(status, 0, stderr);
        const events = stdout
          .trim()
          .split('\n')
          .map(line => JSON.parse(line));
        assert.equal(events[0].result.event, 'ready');
        assert.equal(events[1].result.event, 'closed');
        assert.equal(events[0].result.ggbSha256, events[1].result.ggbSha256);
        const cleanup = JSON.parse(
          await readFile(
            join(events[1].result.diagnostics, 'cleanup.json'),
            'utf8',
          ),
        );
        assert.equal(cleanup.sessions.length, 2);
        assert.ok(
          cleanup.sessions.every((s: {cleanup: {ok: boolean}}) => s.cleanup.ok),
        );
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}
