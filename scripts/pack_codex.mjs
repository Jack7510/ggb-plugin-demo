/** @fileoverview 构建后的本地 Codex 打包入口；不安装、不发布，不改全局配置。 */
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {packagePlugin} from '../dist/src/package_plugin.js';

if (process.argv.length !== 2) {
  throw new Error('pack:codex accepts no arguments.');
}
const root = fileURLToPath(new URL('../', import.meta.url));
console.log(
  JSON.stringify(await packagePlugin(root, join(root, 'output', 'packages'))),
);
