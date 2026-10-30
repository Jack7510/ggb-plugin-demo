/**
 * @fileoverview 将教学工具装成独立 Codex 本地来源包；只打包，不注册或安装。
 */

import {execFileSync} from 'node:child_process';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {sha256} from './runtime.js';

const pluginName = 'ggb-plugin-demo';
const marketplaceName = 'ggb-plugin-demo-local';
const roots = [
  'plugin.json',
  'package.json',
  'pnpm-lock.yaml',
  'runtime.lock.json',
  'THIRD_PARTY_NOTICES.md',
  'README.md',
  'AGENTS.md',
  'tsconfig.json',
  'eslint.config.js',
  '.prettierrc.json',
  'dist/src',
  'src',
  'tests',
  'scripts',
  'viewer',
  'schemas',
  'examples',
  'skills',
  'docs',
];

/**
 * 从当前源码及已构建模块生成 ZIP、摘要和本地 marketplace；每次使用新目录。
 * 依赖、运行时、客户端缓存与用户产物不在根白名单内；安装副本须独立准备资源。
 * @param root 本工程根；必须先构建，不能用其他工程的 dist 替代。
 * @param outputRoot 产物父目录；不会覆盖旧包或删除失败暂存。
 */
export async function packagePlugin(root: string, outputRoot: string) {
  const manifest = JSON.parse(
    await readFile(join(root, 'plugin.json'), 'utf8'),
  ) as {
    name: string;
    version: string;
  };
  const pkg = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  ) as {
    name: string;
    version: string;
    private: boolean;
  };
  if (
    manifest.name !== pluginName ||
    pkg.name !== pluginName ||
    manifest.version !== pkg.version ||
    !/^\d+\.\d+\.\d+$/.test(pkg.version) ||
    pkg.private !== true
  ) {
    throw new Error('Plugin identity/version must match the private package.');
  }
  await mkdir(outputRoot, {recursive: true});
  const directory = await mkdtemp(join(outputRoot, 'codex-package-'));
  const marketplaceRoot = join(directory, 'marketplace');
  const pluginRoot = join(marketplaceRoot, 'plugins', pluginName);
  const files: Record<string, string> = {};
  /** 逐项拒绝软链接和特殊文件，避免源码链接把包扩展到缓存或仓库外。 */
  async function copyEntry(name: string): Promise<void> {
    const source = join(root, name);
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error(
        'Package source must not contain symbolic links: ' + name,
      );
    }
    if (info.isDirectory()) {
      for (const child of (await readdir(source)).sort()) {
        await copyEntry(join(name, child));
      }
    } else if (info.isFile()) {
      if (name.endsWith('.tsbuildinfo') || name.endsWith('.DS_Store')) {
        return;
      }
      const target = join(pluginRoot, name);
      await mkdir(dirname(target), {recursive: true});
      await copyFile(source, target);
      files[name.split('\\').join('/')] = sha256(await readFile(target));
    } else {
      throw new Error('Package source is not a regular file: ' + name);
    }
  }
  for (const name of roots) {
    await copyEntry(name);
  }
  for (const name of [
    'dist/src/cli.js',
    'viewer/engine.html',
    'schemas/request.schema.json',
    'skills/ggb-demo-construction/SKILL.md',
    'scripts/setup_runtime.mjs',
    'scripts/setup-plugin.mjs',
    'skills/setup/SKILL.md',
  ]) {
    if (!files[name]) {
      throw new Error('Missing required plugin resource: ' + name);
    }
  }
  const catalogDirectory = join(marketplaceRoot, '.agents', 'plugins');
  await mkdir(catalogDirectory, {recursive: true});
  await writeFile(
    join(catalogDirectory, 'marketplace.json'),
    JSON.stringify(
      {
        name: marketplaceName,
        interface: {displayName: 'GeoGebra Demo Local'},
        plugins: [
          {
            name: pluginName,
            source: {source: 'local', path: './plugins/' + pluginName},
            policy: {installation: 'AVAILABLE', authentication: 'ON_INSTALL'},
            category: 'Productivity',
          },
        ],
      },
      null,
      2,
    ) + '\n',
  );
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const dirty =
    execFileSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
    }).trim() !== '';
  await writeFile(
    join(marketplaceRoot, 'package-receipt.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        plugin: pluginName,
        version: pkg.version,
        marketplace: marketplaceName,
        sourceRevision: revision,
        sourceWorktreeDirty: dirty,
        files,
        excluded: [
          'node_modules',
          '.runtime',
          '.runtime-download',
          '.pnpm-store',
          'output',
          '.git',
          '.archify',
          '.setup',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  const archive = resolve(directory, `${pluginName}-${pkg.version}-codex.zip`);
  // 固定归档根，不把调用方给定路径作为 shell 命令拼接。
  execFileSync(
    'zip',
    ['-qr', archive, '.agents', 'plugins', 'package-receipt.json'],
    {cwd: marketplaceRoot},
  );
  execFileSync('unzip', ['-tq', archive], {stdio: 'pipe'});
  const digest = sha256(await readFile(archive));
  await writeFile(
    archive + '.sha256',
    digest + '  ' + relative(directory, archive) + '\n',
  );
  return {
    scope: 'local-codex-package',
    archive,
    sha256: digest,
    marketplaceRoot,
    pluginRoot,
    plugin: pluginName,
    version: pkg.version,
    marketplace: marketplaceName,
  };
}
