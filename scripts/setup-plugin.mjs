/** @fileoverview 固定安装入口；命名按用户约定保留，失败非零退出且不输出 ready。 */
import {fileURLToPath} from 'node:url';
import {setupPlugin, SetupError} from '../dist/src/setup_plugin.js';

try {
  const args = process.argv.slice(2);
  if (
    args.length !== 0 &&
    !(
      args.length === 2 &&
      args[0] === '--workspace' &&
      args[1].trim() &&
      !args[1].startsWith('--')
    )
  ) {
    throw new SetupError(
      'arguments',
      'Expected setup-plugin.mjs [--workspace <path>]',
    );
  }
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = await setupPlugin(root, args[1] ?? process.cwd());
  process.stdout.write(JSON.stringify({ok: true, result}) + '\n');
} catch (error) {
  process.stderr.write(
    JSON.stringify({
      ok: false,
      error: {
        code: 'SETUP_FAILED',
        stage: error instanceof SetupError ? error.stage : 'preflight',
        message: String(error),
        diagnostics:
          error instanceof SetupError ? error.diagnostics : undefined,
      },
    }) + '\n',
  );
  process.exitCode = 1;
}
