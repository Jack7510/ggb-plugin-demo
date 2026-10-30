/**
 * @fileoverview 验证不完整和不安全的交付在启动引擎前被拒绝。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readDelivery} from '../src/delivery.js';
import {ToolError} from '../src/errors.js';
await test('preview refuses old minimal builds, incomplete manifests and unsafe file paths before loading an engine', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ggb-manifest-'));
  try {
    for (const manifest of [
      {schemaVersion: 1, kind: 'minimal-build-not-full-acceptance', files: {}},
      {
        schemaVersion: 2,
        kind: 'delivery',
        ggbFile: 'construction.ggb',
        files: {},
      },
      {
        schemaVersion: 2,
        kind: 'delivery',
        ggbFile: 'construction.ggb',
        files: {'../outside': 'a'.repeat(64)},
      },
    ]) {
      await writeFile(
        join(directory, 'manifest.json'),
        JSON.stringify(manifest),
      );
      await assert.rejects(
        readDelivery(directory),
        e => e instanceof ToolError && e.code === 'PREVIEW_ERROR',
      );
    }
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
