/** @fileoverview 当前安装副本的一键准备；doctor 与资源关闭通过前不产生 ready 结果。 */
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {detectBrowser, type BrowserSelection} from './browser_selection.js';
import {runtimeIdentity, sha256} from './runtime.js';

interface PackageMetadata {
  name: string;
  version: string;
  packageManager: string;
  dependencies: Record<string, string>;
}
/** setup 失败始终返回稳定阶段与本次诊断，不宣称安装已就绪。 */
export class SetupError extends Error {
  constructor(
    readonly stage: string,
    message: string,
    readonly diagnostics?: string,
  ) {
    super(message);
  }
}
/** 资源根不得通过软链接指向其他安装、缓存或用户目录。 */
export async function assertLocalResources(root: string): Promise<void> {
  for (const name of [
    'node_modules',
    '.pnpm-store',
    '.runtime',
    '.runtime-download',
    '.setup',
  ]) {
    try {
      const info = await lstat(join(root, name));
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error('Resource must be a local directory: ' + name);
      }
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      )) {
        throw error;
      }
    }
  }
}
/** 已有依赖必须匹配声明版本并从本安装根解析；缺失时只允许整个首次安装。 */
export async function inspectDependencies(
  root: string,
  expected: Record<string, string>,
): Promise<Record<string, {version: string; path: string}> | null> {
  try {
    await lstat(join(root, 'node_modules'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
  const require = createRequire(join(root, 'package.json'));
  const result: Record<string, {version: string; path: string}> = {};
  for (const [name, version] of Object.entries(expected)) {
    const path = await realpath(require.resolve(name + '/package.json'));
    const base = join(root, 'node_modules') + sep;
    if (!path.startsWith(base)) {
      throw new Error('Dependency resolves outside installation: ' + name);
    }
    const actual = JSON.parse(await readFile(path, 'utf8')) as {
      version: string;
    };
    if (actual.version !== version) {
      throw new Error(
        `Dependency mismatch: ${name}, expected ${version}, actual ${actual.version}`,
      );
    }
    result[name] = {version, path};
  }
  return result;
}
/** 校验已有压缩包和运行时；损坏 receipt 不是“首次安装”，不能静默覆盖。 */
export async function inspectRuntime(root: string): Promise<void> {
  const lock = JSON.parse(
    await readFile(join(root, 'runtime.lock.json'), 'utf8'),
  ) as {sha256: string};
  try {
    const bytes = await readFile(join(root, '.runtime-download/geogebra.zip'));
    if (sha256(bytes) !== lock.sha256) {
      throw new Error('Existing runtime archive SHA-256 mismatch');
    }
  } catch (error) {
    if (!(
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    )) {
      throw error;
    }
  }
  let exists = true;
  try {
    await lstat(join(root, '.runtime'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      exists = false;
    } else {
      throw error;
    }
  }
  if (exists) {
    await runtimeIdentity(root);
    await readFile(join(root, '.runtime/README.txt'));
  }
}
/**
 * 安装根由调用入口定位，workspace 只接收 doctor 证据。既有不匹配状态不自动修复。
 * 无论首次还是再次运行，都必须重新完成真实 doctor；不会安装全局依赖或浏览器。
 */
export async function setupPlugin(
  installationRoot: string,
  workspacePath: string,
) {
  let stage = 'preflight';
  let diagnostics: string | undefined;
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  const root = await realpath(installationRoot);
  const workspace = await realpath(resolve(workspacePath));
  if (!(await lstat(workspace)).isDirectory()) {
    throw new SetupError(stage, 'Doctor workspace must be a directory');
  }
  const relation = relative(root, workspace);
  if (
    relation === '' ||
    (!relation.startsWith('..' + sep) &&
      relation !== '..' &&
      !isAbsolute(relation))
  ) {
    throw new SetupError(
      stage,
      'Doctor workspace must be outside the installation root',
    );
  }
  try {
    if (Number(process.versions.node.split('.')[0]) < 22) {
      throw new Error(
        'Node.js 22+ required; do not change global Node automatically',
      );
    }
    await assertLocalResources(root);
    await mkdir(join(root, '.setup'), {recursive: true});
    // 排他锁防止两个初始化过程同时改写依赖；旧锁需人工诊断，不自动删除。
    lock = await open(join(root, '.setup/lock'), 'wx');
    diagnostics = await mkdtemp(join(root, '.setup/run-'));
    const save = (name: string, value: unknown) =>
      writeFile(
        join(diagnostics!, name),
        JSON.stringify(value, null, 2) + '\n',
      );
    function run(
      command: string,
      args: string[],
      cwd: string,
      timeout = 180_000,
    ): string {
      try {
        const output = execFileSync(command, args, {
          cwd,
          encoding: 'utf8',
          timeout,
          maxBuffer: 8 * 1024 * 1024,
          env: {...process.env, NODE_PATH: ''},
        });
        return output;
      } catch (error) {
        throw new Error(`${command} failed during ${stage}: ${String(error)}`);
      }
    }
    const metadata = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    ) as PackageMetadata;
    const manifest = JSON.parse(
      await readFile(join(root, 'plugin.json'), 'utf8'),
    ) as {name: string; version: string};
    if (
      metadata.name !== 'ggb-plugin-demo' ||
      manifest.name !== metadata.name ||
      manifest.version !== metadata.version ||
      metadata.packageManager !== 'pnpm@11.7.0'
    ) {
      throw new Error(
        'Plugin/package identity or pinned pnpm version mismatch',
      );
    }
    await readFile(join(root, 'dist/src/cli.js'));
    const pnpmVersion = run('pnpm', ['--version'], root, 10_000).trim();
    if (pnpmVersion !== metadata.packageManager.slice(5)) {
      throw new Error(
        'pnpm 11.7.0 required; do not change global pnpm automatically',
      );
    }
    const packageHash = sha256(await readFile(join(root, 'package.json')));
    const lockHash = sha256(await readFile(join(root, 'pnpm-lock.yaml')));
    stage = 'existing-resources';
    let dependencies = await inspectDependencies(root, metadata.dependencies);
    await inspectRuntime(root);
    stage = 'browser-detection';
    const browser: BrowserSelection = detectBrowser();
    await save('browser.json', browser);
    await save('preparation.json', {
      root,
      workspace,
      node: process.version,
      pnpm: pnpmVersion,
      reuseDependencies: dependencies !== null,
    });
    stage = 'dependencies';
    if (dependencies === null) {
      const output = run(
        'pnpm',
        [
          'install',
          '--prod',
          '--frozen-lockfile',
          '--ignore-scripts',
          '--store-dir',
          join(root, '.pnpm-store'),
        ],
        root,
      );
      await writeFile(join(diagnostics, 'dependencies.log'), output);
      dependencies = await inspectDependencies(root, metadata.dependencies);
      if (dependencies === null) {
        throw new Error('Dependency preparation did not create local modules');
      }
    }
    if (
      sha256(await readFile(join(root, 'package.json'))) !== packageHash ||
      sha256(await readFile(join(root, 'pnpm-lock.yaml'))) !== lockHash
    ) {
      throw new Error('Frozen dependency inputs changed during setup');
    }
    await save('dependencies.json', dependencies);
    stage = 'runtime';
    const runtimeOutput = run(
      process.execPath,
      [join(root, 'scripts/setup_runtime.mjs')],
      root,
      240_000,
    );
    await writeFile(join(diagnostics, 'runtime.log'), runtimeOutput);
    const runtime = await runtimeIdentity(root);
    stage = 'doctor';
    const doctorOutput = run(
      process.execPath,
      [join(root, 'dist/src/cli.js'), 'doctor'],
      workspace,
      120_000,
    );
    await writeFile(join(diagnostics, 'doctor-response.json'), doctorOutput);
    const doctor = JSON.parse(doctorOutput) as {
      ok: boolean;
      command: string;
      result: {
        scope: string;
        artifactDirectory: string;
        cleanup: {ok: boolean};
      };
    };
    if (
      doctor.ok !== true ||
      doctor.command !== 'doctor' ||
      doctor.result.scope !== 'runtime-readiness' ||
      doctor.result.cleanup.ok !== true
    ) {
      throw new Error('Doctor or cleanup did not report readiness');
    }
    const doctorEnvironment = JSON.parse(
      await readFile(
        join(doctor.result.artifactDirectory, 'environment.json'),
        'utf8',
      ),
    ) as {browserSelection: BrowserSelection};
    if (
      doctorEnvironment.browserSelection?.executablePath !==
      browser.executablePath
    ) {
      throw new Error('Doctor used a different browser than setup detected');
    }
    const result = {
      scope: 'installation-readiness',
      status: 'ready',
      installationRoot: root,
      workspace,
      version: metadata.version,
      browser,
      runtime,
      dependencies,
      doctor: doctor.result,
      diagnostics,
    };
    await save('result.json', result);
    return result;
  } catch (error) {
    const failure = new SetupError(stage, String(error), diagnostics);
    if (diagnostics) {
      await writeFile(
        join(diagnostics, 'failure.json'),
        JSON.stringify(
          {
            scope: 'setup-diagnostics-only',
            status: 'failed',
            stage,
            message: failure.message,
          },
          null,
          2,
        ) + '\n',
      );
    }
    throw failure;
  } finally {
    if (lock) {
      await lock.close();
      await unlink(join(root, '.setup/lock'));
    }
  }
}
