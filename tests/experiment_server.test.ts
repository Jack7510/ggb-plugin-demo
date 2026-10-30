/**
 * @fileoverview 验证本地资源服务的文件边界，包括目录穿越和软链接逃逸。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, writeFile, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../src/experiment_support.js';

await test('experiment server serves only fixed viewer routes and contained runtime files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ggb-demo-server-'));
  let local: Awaited<ReturnType<typeof startServer>> | undefined;
  try {
    await mkdir(join(root, '.runtime/GeoGebra'), {recursive: true});
    await mkdir(join(root, 'viewer'));
    await writeFile(
      join(root, 'viewer/experiment.html'),
      '<title>test route</title>',
    );
    await writeFile(join(root, 'secret.txt'), 'private');
    await writeFile(join(root, '.runtime/GeoGebra/local.js'), '// local');
    await symlink(
      join(root, 'secret.txt'),
      join(root, '.runtime/GeoGebra/escape.txt'),
    );
    local = await startServer(root);
    assert.equal((await fetch(local.origin)).status, 200);
    assert.equal(
      (await fetch(local.origin + '/runtime/GeoGebra/local.js')).status,
      200,
    );
    for (const path of [
      '/secret.txt',
      '/runtime/GeoGebra/escape.txt',
      '/runtime/GeoGebra/%2e%2e%2f%2e%2e%2fsecret.txt',
    ]) {
      assert.equal((await fetch(local.origin + path)).status, 403);
    }
    assert.equal((await fetch(local.origin, {method: 'POST'})).status, 403);
  } finally {
    if (local) {
      await new Promise<void>((resolve, reject) => {
        local!.server.close(error => (error ? reject(error) : resolve()));
        local!.server.closeAllConnections();
      });
    }
    await rm(root, {recursive: true, force: true});
  }
});
