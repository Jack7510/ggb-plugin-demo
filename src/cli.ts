/**
 * @fileoverview 独立 CLI 入口：解析命令、分派执行，并保持 stdout/stderr 的机器可读契约。
 */

import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readRequest} from './request.js';
import {runTool} from './pipeline.js';
import {preview} from './preview.js';
import {ToolError} from './errors.js';

// 程序资源按自身安装目录定位；用户给定的请求路径仍按调用工作目录解释。
const root = fileURLToPath(new URL('../../', import.meta.url));
const version = (
  JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as {version: string}
).version;
const outputRoot = join(process.cwd(), 'output');
const args = process.argv.slice(2);
const [command, flag, value] = args;
try {
  if (args.length === 0 || (args.length === 1 && command === '--help')) {
    process.stdout.write(
      `ggb-plugin-demo ${version}\nUsage: node dist/src/cli.js <command>\n\n` +
        'doctor\ncheck --request <path>\nbuild --request <path>\npreview --delivery <path>\n\n' +
        'build commits a delivery only when all declared requirements, real mouse drag samples and cleanup pass.\nOptions: --help, --version\n',
    );
  } else if (args.length === 1 && command === '--version') {
    process.stdout.write(`${version}\n`);
  } else {
    if (!['doctor', 'check', 'build', 'preview'].includes(command ?? '')) {
      throw new ToolError('INVALID_ARGUMENT', 'Unknown command. Use --help.');
    }
    const expected = command === 'preview' ? '--delivery' : '--request';
    // 严格限定参数形状，拒绝额外参数，避免调用方误以为未支持选项已生效。
    const valid =
      command === 'doctor'
        ? args.length === 1
        : args.length === 3 &&
          flag === expected &&
          !!value?.trim() &&
          !value.startsWith('--');
    if (!valid) {
      throw new ToolError(
        'INVALID_ARGUMENT',
        command === 'doctor'
          ? 'doctor accepts no arguments.'
          : `Expected ${command} ${expected} <path>.`,
      );
    }
    let result: unknown;
    if (command === 'preview') {
      // preview 是长生命周期命令：先发 ready，关闭和清理后再发最终结果。
      result = await preview(
        root,
        value!,
        data =>
          process.stdout.write(
            JSON.stringify({
              schemaVersion: 2,
              ok: true,
              command,
              result: data,
            }) + '\n',
          ),
        outputRoot,
      );
    } else if (command === 'doctor') {
      result = await runTool('doctor', root, undefined, outputRoot);
    } else {
      // check 与 build 共用同一请求预检；结构通过不等于数学条件成立。
      const request = await readRequest(value!);
      result =
        command === 'check'
          ? {
              scope: 'input-validation-only',
              requirementCount: request.requirements.length,
              checkCount: request.checks.length,
              mathematicalValidity: 'not-evaluated',
              interactionCount: request.interactions.length,
              unsupportedCapabilities: [],
            }
          : await runTool('build', root, request, outputRoot);
    }
    process.stdout.write(
      JSON.stringify({schemaVersion: 2, ok: true, command, result}) + '\n',
    );
  }
} catch (failure) {
  const error =
    failure instanceof ToolError
      ? failure
      : new ToolError('INTERNAL_ERROR', String(failure));
  // 失败不能污染成功数据流；调用方结合非零退出码解析 stderr 中的 JSON。
  process.stderr.write(
    JSON.stringify({
      schemaVersion: 2,
      ok: false,
      command: command ?? null,
      error: {
        code: error.code,
        message: error.message,
        ...(error.diagnostics ? {diagnostics: error.diagnostics} : {}),
      },
    }) + '\n',
  );
  process.exitCode =
    error.code === 'INVALID_ARGUMENT'
      ? 2
      : error.code === 'NOT_IMPLEMENTED'
        ? 3
        : 1;
}
