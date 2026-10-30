/**
 * @fileoverview 只读回环资源服务；仅提供固定页面和 realpath 限定的运行时文件。
 */

import {createServer} from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import assert from 'node:assert/strict';

/** 在随机回环端口提供固定资源；模式只选择可信入口，不接受任意路径。 */
export async function startServer(
  root: string,
  mode: 'experiment' | 'engine' = 'experiment',
) {
  const runtime = await realpath(resolve(root, '.runtime/GeoGebra'));
  const requests: {path: string; status: number}[] = [];
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.wasm': 'application/wasm',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };
  const server = createServer(async (incomingRequest, response) => {
    let status = 403;
    try {
      const path = decodeURIComponent(
        new URL(incomingRequest.url ?? '/', 'http://localhost').pathname,
      );
      let file: string;
      if (
        incomingRequest.method !== 'GET' ||
        !incomingRequest.headers.host?.startsWith('127.0.0.1:')
      ) {
        throw new Error('Rejected request');
      }
      if (path === '/') {
        file = resolve(
          root,
          mode === 'experiment'
            ? 'viewer/experiment.html'
            : 'viewer/engine.html',
        );
      } else if (path === '/engine.js') {
        file = resolve(root, 'viewer/engine.js');
      } else if (path === '/experiment.js' && mode === 'experiment') {
        file = resolve(root, 'viewer/experiment.js');
      } else if (path.startsWith('/runtime/GeoGebra/')) {
        // 只做字符串路径前缀检查会漏掉软链接，因此先解析真实路径。
        file = await realpath(
          resolve(runtime, path.slice('/runtime/GeoGebra/'.length)),
        );
        // 加目录分隔符，防止相邻的同名前缀目录被误认为运行时子目录。
        if (!file.startsWith(runtime + sep)) {
          throw new Error('Outside runtime');
        }
      } else {
        throw new Error('Route not allowed');
      }
      const bytes = await readFile(file);
      status = 200;
      response.writeHead(status, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(bytes);
    } catch {
      // 统一拒绝响应，不向页面泄露磁盘路径或底层文件读取错误。
      response.writeHead(status);
      response.end('Not allowed');
    } finally {
      requests.push({path: incomingRequest.url ?? '/', status});
    }
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    // 随机回环端口避免并发调用冲突；不向局域网开放资源服务。
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {server, origin: `http://127.0.0.1:${address.port}`, requests};
}
