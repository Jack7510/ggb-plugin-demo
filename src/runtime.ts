/**
 * @fileoverview 核对本工程独立下载的固定运行时身份，禁止借用其他客户端的缓存。
 */

import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ToolError} from './errors.js';

/** 对实际字节计算 SHA-256，用于压缩包与交付文件的身份核对。 */
export function sha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}
/** 重新检查压缩包、receipt 和许可；不宣称已逐文件审计解压目录。 */
export async function runtimeIdentity(root: string) {
  try {
    const lock = JSON.parse(
      await readFile(join(root, 'runtime.lock.json'), 'utf8'),
    ) as {version: string; sha256: string; url: string};
    const receipt = JSON.parse(
      await readFile(join(root, '.runtime/receipt.json'), 'utf8'),
    );
    // receipt 只是来源记录，不能替代对当前压缩包实际字节的重新计算。
    const digest = sha256(
      await readFile(join(root, '.runtime-download/geogebra.zip')),
    );
    if (
      digest !== lock.sha256 ||
      receipt.sha256 !== digest ||
      receipt.version !== lock.version ||
      receipt.url !== lock.url
    ) {
      throw new Error('Runtime archive or receipt does not match lock');
    }
    // 加载器存在也不等于 applet 可用；真实就绪和版本检查由执行会话完成。
    await readFile(join(root, '.runtime/GeoGebra/deployggb.js'));
    const license = await readFile(
      join(root, '.runtime-download/geogebra-license.html'),
    );
    return {
      ...lock,
      verifiedArchiveSha256: digest,
      licenseSha256: sha256(license),
      extractedFileAudit: 'not-performed',
    };
  } catch (error) {
    throw new ToolError('RUNTIME_UNAVAILABLE', String(error));
  }
}
