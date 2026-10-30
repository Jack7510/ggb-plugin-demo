/**
 * @fileoverview 交付文件和原生 GGB 审计；不将任意外部文件或旧实验结果当作正式交付。
 */

import {lstat, readFile, readdir, realpath} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseRequest} from './request.js';
import {
  compareReload,
  summarizeRequirements,
  verifyRequest,
  type Facts,
} from './verify.js';
import {evaluateDrag, type DragEvidence} from './interaction.js';
import {sha256} from './runtime.js';
import {ToolError} from './errors.js';

// 与管线 capture 的阶段一致：截图、XML、日志和许可也是交付的一部分。
// 不能通过删文件并同步清单，把缺少原始证据的目录变成“完整交付”。
const required = [
  'construction.ggb',
  'request.json',
  'verification.json',
  'preview.png',
  'cleanup.json',
  'runtime.json',
  'environment.json',
  'requests.json',
  'browser-log.json',
  'runtime-README.txt',
  'geogebra-license.html',
  ...[
    'engine-ready',
    'constructed',
    'exported',
    'reload-empty',
    'reloaded',
  ].flatMap(stage =>
    ['json', 'xml', 'png'].map(extension => `${stage}.${extension}`),
  ),
];
// 26 个基础文件加 20 × 9 个交互证据文件共 206 项；保留有界余量。
const maxManifestFiles = 256;
/** 只接受当前 CLI 生成的基础 GGB 内容，拒绝脚本、宏和额外资源。 */
export function auditGgb(path: string) {
  // 当前只处理工具自身导出的基础包，不把任意附件或宏作为加载入口。
  const allowed = new Set([
    'geogebra.xml',
    'geogebra_defaults2d.xml',
    'geogebra_defaults3d.xml',
    'geogebra_javascript.js',
    'geogebra_thumbnail.png',
  ]);
  // 即使输入压缩包损坏，也要约束外部检查进程的耗时和输出容量。
  const options = {timeout: 5_000, maxBuffer: 4 * 1024 * 1024};
  const entries = execFileSync('unzip', ['-Z1', resolve(path)], options)
    .toString()
    .trim()
    .split('\n');
  if (
    !entries.includes('geogebra.xml') ||
    new Set(entries).size !== entries.length ||
    entries.some(entry => !allowed.has(entry))
  ) {
    throw new ToolError(
      'VERIFICATION_FAILED',
      'GGB contains unsupported entries',
    );
  }
  execFileSync('unzip', ['-t', resolve(path)], options);
  if (entries.includes('geogebra_javascript.js')) {
    const script = execFileSync(
      'unzip',
      ['-p', resolve(path), 'geogebra_javascript.js'],
      options,
    ).toString();
    // 官方默认空初始化函数可以保留，任何自定义 JavaScript 都拒绝。
    if (!/^\s*(?:function\s+ggbOnInit\s*\(\s*\)\s*\{\s*\})?\s*$/.test(script)) {
      throw new ToolError('VERIFICATION_FAILED', 'GGB contains JavaScript');
    }
  }
  const xml = execFileSync(
    'unzip',
    ['-p', resolve(path), 'geogebra.xml'],
    options,
  ).toString();
  if (/<(?:ggbscript|javascript|image)\b|<!DOCTYPE|<!ENTITY|&#/i.test(xml)) {
    throw new ToolError(
      'VERIFICATION_FAILED',
      'GGB contains scripts or unsupported external content',
    );
  }
}
/** 只接受已实现并已验证的拖动能力；未来新增交互类型必须显式失败。 */
export function assertCapabilities(request: ReturnType<typeof parseRequest>) {
  for (const sample of request.interactions) {
    if (sample.kind !== 'drag') {
      throw new ToolError(
        'UNSUPPORTED_CAPABILITY',
        'Only real mouse drag interactions are supported',
      );
    }
  }
}
/** 校验完整目录并重算记录中的检查，不能仅信任 manifest 或 passed 文本。 */
export async function readDelivery(path: string) {
  try {
    const directory = await realpath(path);
    // 清单项只能是有界普通文件，不能经软链接转向目录外的内容。
    const file = async (name: string) => {
      const p = join(directory, name);
      const info = await lstat(p);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size > 16 * 1024 * 1024
      ) {
        throw new Error('Not a bounded regular delivery file: ' + name);
      }
      return readFile(p);
    };
    const manifest = JSON.parse((await file('manifest.json')).toString());
    if (
      manifest.schemaVersion !== 2 ||
      manifest.kind !== 'delivery' ||
      manifest.ggbFile !== 'construction.ggb' ||
      !manifest.files ||
      typeof manifest.files !== 'object' ||
      Array.isArray(manifest.files)
    ) {
      throw new Error('Not a v2 formal delivery manifest');
    }
    const names = Object.keys(manifest.files);
    if (
      names.length > maxManifestFiles ||
      !names.every(name => /^[A-Za-z][A-Za-z0-9_.-]{0,100}$/.test(name))
    ) {
      throw new Error('Incomplete or unsafe manifest');
    }
    // 目录内容必须与清单一一对应，不能额外混入未核对的材料。
    const actualNames = await readdir(directory);
    if (
      actualNames.length !== names.length + 1 ||
      !actualNames.every(
        name => name === 'manifest.json' || names.includes(name),
      )
    ) {
      throw new Error('Unexpected or missing delivery files');
    }
    // 摘要校验后保留同一份字节，后续预览使用这份已确认身份的 GGB。
    const files = new Map<string, Buffer>();
    for (const name of names) {
      const bytes = await file(name);
      files.set(name, bytes);
      if (
        !/^[a-f0-9]{64}$/.test(manifest.files[name]) ||
        sha256(bytes) !== manifest.files[name]
      ) {
        throw new Error('Delivery hash mismatch: ' + name);
      }
    }
    // 先核对基础文件，再解析请求；缺文件必须返回明确诊断。
    for (const name of required) {
      if (!files.has(name)) {
        throw new Error('Missing required delivery file: ' + name);
      }
    }
    const json = (name: string) => JSON.parse(files.get(name)!.toString());
    const request = parseRequest(json('request.json'));
    assertCapabilities(request);
    // 每个样本的空态、拖动前、拖动后都保留完整 capture 三件套。
    const interactionFiles = request.interactions.flatMap(sample =>
      ['empty', 'before', 'after'].flatMap(stage =>
        ['json', 'xml', 'png'].map(
          extension => `interaction-${sample.id}-${stage}.${extension}`,
        ),
      ),
    );
    const requiredFiles = [...required, ...interactionFiles];
    for (const name of interactionFiles) {
      if (!files.has(name)) {
        throw new Error('Missing required delivery file: ' + name);
      }
    }
    if (
      sha256(files.get('request.json')!) !== manifest.requestSha256 ||
      JSON.stringify(manifest.outputs) !== JSON.stringify(request.outputs)
    ) {
      throw new Error('Request/output identity mismatch');
    }
    const report = json('verification.json');
    const cleanup = json('cleanup.json');
    const before = json('constructed.json') as Facts;
    const after = json('reloaded.json') as Facts;
    if (
      cleanup.ok !== true ||
      cleanup.browserDisconnected !== true ||
      cleanup.serverStopped !== true ||
      !['page', 'context', 'browser', 'server'].every(
        name => cleanup[name] === 'closed-or-not-created',
      ) ||
      !Array.isArray(report.interactions) ||
      report.interactions.length !== request.interactions.length ||
      !report.interactions.every(
        (item: {status: string}) => item.status === 'passed',
      ) ||
      report.mouseInteraction !==
        (request.interactions.length ? 'verified' : 'not-requested') ||
      report.scope !== 'declared-request' ||
      report.status !== 'passed' ||
      report.contentEqual !== true ||
      report.reports?.length !== 2 ||
      !report.reports.every((r: {ok: boolean}) => r.ok)
    ) {
      throw new Error('Delivery gates are incomplete');
    }
    // passed 字段本身不是证据；重新从保存的事实计算条件和重载一致性。
    const initial = verifyRequest(request, before);
    const reloaded = verifyRequest(request, after);
    if (
      !initial.ok ||
      !reloaded.ok ||
      !compareReload(before, after) ||
      JSON.stringify(report.reports) !==
        JSON.stringify([
          {phase: 'initial', ...initial},
          {phase: 'reloaded', ...reloaded},
        ])
    ) {
      throw new Error('Recorded conditions fail re-verification');
    }
    const identity = json('runtime.json');
    if (
      JSON.stringify(manifest.runtime) !== JSON.stringify(identity) ||
      after.engineVersion !== identity.version ||
      before.engineVersion !== identity.version
    ) {
      throw new Error('Runtime identity mismatch');
    }
    const png = (name: string) => {
      const bytes = files.get(name);
      if (
        !bytes ||
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ) {
        throw new Error('Invalid PNG evidence: ' + name);
      }
    };
    for (const name of requiredFiles.filter(name => name.endsWith('.png'))) {
      png(name);
    }
    // 每个样本从 manifest 关联的磁盘 GGB 独立加载；重算前后事实、目标位移和依赖。
    const interactionReports = request.interactions.map((sample, index) => {
      const saved = report.interactions[index];
      const prefix = `interaction-${sample.id}`;
      const screenshots = {
        before: `${prefix}-before.png`,
        after: `${prefix}-after.png`,
      };
      const empty = json(`${prefix}-empty.json`) as Facts;
      const sampleBefore = json(`${prefix}-before.json`) as Facts;
      const sampleAfter = json(`${prefix}-after.json`) as Facts;
      png(screenshots.before);
      png(screenshots.after);
      if (
        saved.id !== sample.id ||
        saved.requirement !== sample.requirement ||
        saved.label !== sample.label ||
        !saved.pointer ||
        !saved.viewBefore ||
        !saved.viewAfter ||
        typeof saved.visible !== 'boolean' ||
        JSON.stringify(saved.screenshots) !== JSON.stringify(screenshots) ||
        saved.source?.file !== 'construction.ggb' ||
        saved.source.sha256 !== manifest.files['construction.ggb'] ||
        saved.source.freshContextEmptyCount !== 0 ||
        empty.objects.length !== 0 ||
        empty.engineVersion !== identity.version ||
        sampleBefore.engineVersion !== identity.version ||
        sampleAfter.engineVersion !== identity.version
      ) {
        throw new Error('Interaction evidence identity mismatch');
      }
      const evidence: DragEvidence = {
        source: {
          file: 'construction.ggb',
          sha256: saved.source.sha256,
          freshContextEmptyCount: empty.objects.length,
          reloadedContentEqual: compareReload(after, sampleBefore),
        },
        pointer: saved.pointer,
        viewBefore: saved.viewBefore,
        viewAfter: saved.viewAfter,
        visible: saved.visible,
        screenshots,
      };
      const recomputed = evaluateDrag(
        request,
        sample,
        sampleBefore,
        sampleAfter,
        evidence,
      );
      if (JSON.stringify(recomputed) !== JSON.stringify(saved)) {
        throw new Error('Interaction evidence fails re-verification');
      }
      return recomputed;
    });
    if (
      JSON.stringify(report.interactions) !== JSON.stringify(interactionReports)
    ) {
      throw new Error('Interaction report order or content mismatch');
    }
    const requirements = summarizeRequirements(
      request,
      report.reports,
      interactionReports,
    );
    if (
      JSON.stringify(report.requirements) !== JSON.stringify(requirements) ||
      !requirements.every(requirement => requirement.status === 'passed')
    ) {
      throw new Error('Requirement summary fails re-verification');
    }
    // 文件摘要只证明内容对应，不代表包内内容属于本工具允许的 GGB 子集。
    auditGgb(join(directory, 'construction.ggb'));
    // 此处仅完成文件与记录复核；preview 还会在真实引擎中再次加载验证。
    return {
      directory,
      manifest,
      request,
      after,
      ggb: files.get('construction.ggb')!,
      ggbSha256: manifest.files['construction.ggb'] as string,
    };
  } catch (error) {
    if (error instanceof ToolError && error.code === 'UNSUPPORTED_CAPABILITY') {
      throw error;
    }
    throw new ToolError('PREVIEW_ERROR', String(error));
  }
}
