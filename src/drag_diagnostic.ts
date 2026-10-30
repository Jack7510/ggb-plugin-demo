/**
 * @fileoverview 明确标注的测试诊断补录入口：在 headless 真实 applet 上用
 * 连续鼠标拖动 A 并录像。它不导出 GGB、不提交 delivery，也不改变正式
 * build/preview 路径；仅用于录制素材和诊断展示。
 */

import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EngineSession} from './browser.js';
import {
  DRAG_HIT_RADIUS_PX,
  evaluateDrag,
  nearbyPoints,
  toPixels,
  type DragEvidence,
} from './interaction.js';
import {readRequest} from './request.js';
import {sha256} from './runtime.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requestPath = join(root, 'examples/triangle.json');
await mkdir(join(root, 'output'), {recursive: true});
const directory = await mkdtemp(join(root, 'output/diagnostic-drag-'));
const videoDir = join(directory, 'video');
await mkdir(videoDir, {recursive: true});
const session = new EngineSession(root, 'engine', true, true, videoDir);
const request = await readRequest(requestPath);
let cleanup: Awaited<ReturnType<EngineSession['close']>> | undefined;
let failure: unknown;
try {
  await session.launch();
  await session.freshApplet();
  await session.run(request);
  const before = await session.snapshot();
  await writeFile(
    join(directory, 'before.json'),
    JSON.stringify(before, null, 2) + '\n',
  );
  await session.page!.screenshot({
    path: join(directory, 'before.png'),
    fullPage: true,
  });
  const viewBefore = await session.viewProperties();
  const object = before.objects.find(item => item.label === 'A');
  if (!object?.coordinates) {
    throw new Error('Diagnostic drag point A is missing');
  }
  const sample = request.interactions[0]!;
  const start = toPixels(object.coordinates, viewBefore);
  const target = toPixels(sample.to, viewBefore);
  const startCandidates = nearbyPoints(before, viewBefore, start, sample.label);
  const targetCandidates = nearbyPoints(
    before,
    viewBefore,
    target,
    sample.label,
  );
  const visible = await session.visible(sample.label);
  const mouse = await session.drag(start, target, 120);
  const after = await session.snapshot();
  await writeFile(
    join(directory, 'after.json'),
    JSON.stringify(after, null, 2) + '\n',
  );
  await session.page!.screenshot({
    path: join(directory, 'after.png'),
    fullPage: true,
  });
  const viewAfter = await session.viewProperties();
  const evidence: DragEvidence = {
    source: {
      file: 'construction.ggb',
      sha256: 'diagnostic-only-not-a-delivery',
      freshContextEmptyCount: 0,
      reloadedContentEqual: true,
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
      before: 'before.png',
      after: 'after.png',
    },
  };
  const report = evaluateDrag(request, sample, before, after, evidence);
  if (report.status !== 'passed') {
    throw new Error('Diagnostic drag failed: ' + report.reasons.join('; '));
  }
  const page = session.page!;
  cleanup = await session.close();
  const video = await page.video()?.path();
  if (!cleanup.ok || !video) {
    throw new Error('Diagnostic cleanup or video capture failed');
  }
  await writeFile(
    join(directory, 'NOT_A_DELIVERY.json'),
    JSON.stringify(
      {
        scope: 'diagnostic-only',
        delivery: false,
        warning:
          'TEST DIAGNOSTIC ONLY: this is not a construction.ggb delivery, not an independent reload and not production evidence.',
        request: {
          path: requestPath,
          sha256: sha256(await readFile(requestPath)),
        },
        interaction: report,
        video,
        cleanup,
        limitations: [
          'This diagnostic constructs in one applet and drags without export/reload; formal build evidence is separate.',
          'Continuous footage is a recording aid, not a proof of all possible drags.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  process.stdout.write(
    [
      'DIAGNOSTIC ONLY - NOT A DELIVERY',
      '  directory: ' + directory,
      '  video: ' + video,
      '  before screenshot: ' + join(directory, 'before.png'),
      '  after screenshot: ' + join(directory, 'after.png'),
      '  drag status: ' + report.status,
      '  A: ' +
        JSON.stringify(report.before?.coordinates) +
        ' -> ' +
        JSON.stringify(report.after?.coordinates),
      '  cleanup: ' + JSON.stringify(cleanup),
    ].join('\n') + '\n',
  );
} catch (error) {
  failure = error;
} finally {
  if (!cleanup) {
    cleanup = await session.close();
  }
  await writeFile(
    join(directory, 'cleanup.json'),
    JSON.stringify(cleanup, null, 2) + '\n',
  );
}
if (failure) {
  await writeFile(
    join(directory, 'failure.json'),
    JSON.stringify({error: String(failure)}, null, 2) + '\n',
  );
  throw failure;
}
