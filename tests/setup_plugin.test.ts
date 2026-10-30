/** @fileoverview 初始化失败必须保留资源且不宣告 ready；浏览器夹具只测试选择逻辑。 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {detectBrowser} from '../src/browser_selection.js';
import {
  assertLocalResources,
  inspectDependencies,
  inspectRuntime,
  setupPlugin,
  SetupError,
} from '../src/setup_plugin.js';

await test(
  'browser detection falls back to Edge and rejects broken probes',
  {skip: process.platform === 'win32'},
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'ggb-browser-choice-'));
    try {
      const edge = join(root, 'edge fixture');
      // 只模拟 --version 的输出，不作为浏览器或引擎执行证据。
      await writeFile(
        edge,
        '#!/bin/sh\nprintf "Microsoft Edge 156.0.0.0\\n"\n',
      );
      await chmod(edge, 0o755);
      const selected = detectBrowser([
        {channel: 'chrome', executablePath: join(root, 'missing')},
        {channel: 'msedge', executablePath: edge},
      ]);
      assert.equal(selected.channel, 'msedge');
      assert.equal(selected.executablePath, await realpath(edge));
      await writeFile(edge, '#!/bin/sh\nexit 7\n');
      assert.throws(
        () => detectBrowser([{channel: 'msedge', executablePath: edge}]),
        /No supported system/,
      );
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  },
);

await test('existing dependency mismatch fails before installation and preserves original files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ggb-setup-mismatch-'));
  const workspace = await mkdtemp(join(tmpdir(), 'ggb-setup-workspace-'));
  try {
    await mkdir(join(root, 'node_modules', 'fixture'), {recursive: true});
    await mkdir(join(root, 'dist', 'src'), {recursive: true});
    await writeFile(
      join(root, 'dist/src/cli.js'),
      '// Must not execute in this failure case.\n',
    );
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'ggb-plugin-demo',
        version: '0.0.1',
        packageManager: 'pnpm@11.7.0',
        dependencies: {fixture: '1.0.0'},
      }),
    );
    await writeFile(
      join(root, 'plugin.json'),
      JSON.stringify({name: 'ggb-plugin-demo', version: '0.0.1'}),
    );
    await writeFile(join(root, 'pnpm-lock.yaml'), 'fixture lock');
    const dependency = join(root, 'node_modules/fixture/package.json');
    const original = JSON.stringify({name: 'fixture', version: '9.0.0'});
    await writeFile(dependency, original);
    await assert.rejects(
      setupPlugin(root, workspace),
      error =>
        error instanceof SetupError &&
        error.stage === 'existing-resources' &&
        error.message.includes('Dependency mismatch'),
    );
    assert.equal(await readFile(dependency, 'utf8'), original);
    const run = (await readdir(join(root, '.setup'))).find(name =>
      name.startsWith('run-'),
    )!;
    const failed = JSON.parse(
      await readFile(join(root, '.setup', run, 'failure.json'), 'utf8'),
    );
    assert.equal(failed.status, 'failed');
    assert.ok(
      !(await readdir(join(root, '.setup', run))).includes('result.json'),
    );
    assert.ok(!(await readdir(join(root, '.setup'))).includes('lock'));
  } finally {
    await rm(root, {recursive: true, force: true});
    await rm(workspace, {recursive: true, force: true});
  }
});

await test('external dependency roots, corrupt runtime archives and malformed receipts are rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ggb-setup-boundary-'));
  const outside = await mkdtemp(join(tmpdir(), 'ggb-setup-external-'));
  try {
    assert.equal(await inspectDependencies(root, {fixture: '1.0.0'}), null);
    await symlink(outside, join(root, 'node_modules'), 'dir');
    await assert.rejects(assertLocalResources(root), /local directory/);
    await rm(join(root, 'node_modules'));
    await mkdir(join(root, '.runtime-download'));
    await writeFile(
      join(root, 'runtime.lock.json'),
      JSON.stringify({sha256: '0'.repeat(64)}),
    );
    const archive = join(root, '.runtime-download/geogebra.zip');
    // 故障注入字节不是有效运行时，也不会被解压或当作引擎证据。
    await writeFile(archive, 'corrupt-download-fixture');
    await assert.rejects(inspectRuntime(root), /SHA-256 mismatch/);
    assert.equal(await readFile(archive, 'utf8'), 'corrupt-download-fixture');
    await rm(archive);
    await mkdir(join(root, '.runtime'));
    await writeFile(join(root, '.runtime/receipt.json'), '{broken');
    await assert.rejects(inspectRuntime(root), /RUNTIME|SyntaxError|JSON/);
    assert.equal(
      await readFile(join(root, '.runtime/receipt.json'), 'utf8'),
      '{broken',
    );
    await assert.rejects(setupPlugin(root, root), /outside the installation/);
  } finally {
    await rm(root, {recursive: true, force: true});
    await rm(outside, {recursive: true, force: true});
  }
});

await test('setup entry rejects unsupported arguments with a nonzero structured failure', () => {
  const script = fileURLToPath(
    new URL('../../scripts/setup-plugin.mjs', import.meta.url),
  );
  const result = spawnSync(
    process.execPath,
    [script, '--arbitrary-url', 'https://example.com'],
    {encoding: 'utf8'},
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  const response = JSON.parse(result.stderr);
  assert.equal(response.ok, false);
  assert.equal(response.error.stage, 'arguments');
});
