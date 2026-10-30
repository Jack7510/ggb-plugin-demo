/**
 * @fileoverview 固定三角形回归驱动，复用共享底层机制，但保留独立的案例断言。
 */

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, writeFile, copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EngineSession} from './browser.js';
import {runtimeIdentity, sha256} from './runtime.js';
import {verify, type Snapshot} from './experiment_support.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
await mkdir(join(root, 'output'), {recursive: true});
const output = await mkdtemp(join(root, 'output/technical-triangle-'));
function save(name: string, data: unknown) {
  return writeFile(join(output, name), JSON.stringify(data, null, 2) + '\n');
}
const session = new EngineSession(root, 'experiment');
let stage = 'runtime';
let error: unknown;
let cleanup: Awaited<ReturnType<EngineSession['close']>> | undefined;
let version = '';
const stages: string[] = [];
async function capture(name: string, check = false) {
  // 固定页面为共享事实增加 midpoint 探针；verify 会核对该原生事实。
  const facts = (await session.snapshot()) as Snapshot;
  await save(`${name}.json`, facts);
  await writeFile(join(output, `${name}.xml`), await session.xml());
  await session.page!.screenshot({
    path: join(output, `${name}.png`),
    fullPage: true,
  });
  if (check) {
    verify(facts, version);
  }
  // 只有事实保存及适用断言均完成，才记录该阶段已完成。
  stages.push(name);
}
try {
  assert.equal(
    process.argv.length,
    2,
    'Technical experiment accepts no input arguments',
  );
  const identity = await runtimeIdentity(root);
  version = identity.version;
  await save('runtime.json', identity);
  await copyFile(
    join(root, '.runtime/README.txt'),
    join(output, 'runtime-README.txt'),
  );
  await copyFile(
    join(root, '.runtime-download/geogebra-license.html'),
    join(output, 'geogebra-license.html'),
  );
  stage = 'launch';
  await session.launch();
  await save('environment.json', {
    node: process.version,
    browser: session.browser!.version(),
    origin: session.local!.origin,
  });
  stage = 'engine-ready';
  await session.freshApplet();
  await capture(stage);
  assert.equal((await session.snapshot()).engineVersion, version);
  stage = 'constructed';
  const commands = await session.page!.evaluate('window.construct()');
  await save('input.json', {
    scope: 'fixed-technical-experiment',
    initialCoordinates: 'Demonstration choice, not mathematical givens',
    commands,
  });
  await capture(stage, true);
  stage = 'exported';
  const ggb = join(output, 'triangle.ggb');
  await writeFile(ggb, Buffer.from(await session.exportGgb(), 'base64'));
  execFileSync('unzip', ['-t', ggb], {stdio: 'pipe'});
  await capture(stage, true);
  const bytes = await readFile(ggb);
  await save('export.json', {
    path: ggb,
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
  // 与通用管线保持相同的隔离条件，但预期仍由固定案例断言独立提供。
  stage = 'reload-empty';
  await session.freshApplet();
  await capture(stage);
  stage = 'reloaded';
  await session.loadGgb((await readFile(ggb)).toString('base64'));
  await capture(stage, true);
} catch (failure) {
  error = failure;
  await save('failure.json', {stage, error: String(failure)});
  if (session.page && !session.page.isClosed()) {
    await session.page
      .screenshot({path: join(output, 'failure.png'), fullPage: true})
      .catch(e => session.log.push(String(e)));
  }
} finally {
  cleanup = await session.close();
  await save('cleanup.json', cleanup);
  await save('browser-log.json', session.log);
  await save('requests.json', {
    local: session.local?.requests ?? [],
    blocked: session.blocked,
  });
}
// 成功来自实际阶段和清理结果，不是写死的演示 passed 标记。
const ok = !error && stages.includes('reloaded') && cleanup.ok;
await save('result.json', {
  scope: 'technical-experiment-not-delivery',
  ok,
  stages,
  cleanup,
  failureStage: error ? stage : null,
  mouseInteraction: 'not-tested',
});
console.log(
  JSON.stringify({scope: 'technical-experiment-not-delivery', ok, output}),
);
if (!ok) {
  process.exitCode = 1;
}
