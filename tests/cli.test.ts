/**
 * @fileoverview 验证命令行协议及预检边界；结构通过不能被误报为数学通过。
 */

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readdirSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
function run(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    ...(cwd ? {cwd} : {}),
  });
}
await test('help describes implemented commands, preview command and version', () => {
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /preview --delivery/);
  assert.equal(help.stderr, '');
  assert.equal(
    run(['--version']).stdout.trim(),
    JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ).version,
  );
});
await test('invalid CLI arguments fail with structured diagnostics', () => {
  for (const args of [
    ['unknown'],
    ['build'],
    ['doctor', '--request', 'x'],
    ['preview', '--delivery', 'x', '--extra'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).error.code, 'INVALID_ARGUMENT');
  }
});
await test('unreadable requests fail before execution and preview rejects invalid delivery', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ggb-demo-cli-'));
  try {
    for (const command of ['check', 'build']) {
      const result = run([command, '--request', 'missing.json'], cwd);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(JSON.parse(result.stderr).error.code, 'INPUT_INVALID');
    }
    const result = run(['preview', '--delivery', 'missing'], cwd);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).error.code, 'PREVIEW_ERROR');
    assert.deepEqual(readdirSync(cwd), []);
  } finally {
    rmSync(cwd, {recursive: true, force: true});
  }
});
await test('check validates real schema without launching an engine', () => {
  const result = run([
    'check',
    '--request',
    fileURLToPath(
      new URL('../../examples/triangle-static.json', import.meta.url),
    ),
  ]);
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.equal(response.result.scope, 'input-validation-only');
  assert.equal(response.result.mathematicalValidity, 'not-evaluated');
});
