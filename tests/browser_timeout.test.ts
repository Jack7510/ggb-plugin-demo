/**
 * @fileoverview 验证桥接超时可以结束等待，让调用者继续进入 finally 清理。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {bounded} from '../src/browser.js';
import {ToolError} from '../src/errors.js';
await test('an unresponsive engine operation times out instead of blocking cleanup forever', async () => {
  await assert.rejects(
    bounded(new Promise<never>(() => {}), 5),
    error => error instanceof ToolError && error.code === 'TIMEOUT',
  );
});
