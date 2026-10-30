/**
 * @fileoverview 从锁定官方地址准备运行时；先核对压缩包摘要，再解压并保留来源记录。
 */

import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

// 不提供任意 URL 或外部压缩包参数，避免准备过程变成通用下载/解压入口。
if (process.argv.length !== 2) {
  throw new Error(
    'No arguments accepted: only the pinned official runtime is allowed.',
  );
}
const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(
  await readFile(join(root, 'runtime.lock.json'), 'utf8'),
);
if (
  lock.url !==
  `https://download.geogebra.org/installers/5.4/geogebra-math-apps-bundle-${lock.version.replaceAll('.', '-')}.zip`
) {
  throw new Error('Unexpected runtime source.');
}
const downloads = join(root, '.runtime-download');
await mkdir(downloads, {recursive: true});
const archive = join(downloads, 'geogebra.zip');
try {
  await readFile(archive);
} catch {
  execFileSync(
    'curl',
    [
      '--fail',
      '--location',
      '--proto',
      '=https',
      '--max-time',
      '180',
      lock.url,
      '-o',
      archive,
    ],
    {stdio: 'inherit'},
  );
}
// 即使本工程已有下载包，也先核对字节摘要；不能以文件存在代替验真。
const digest = createHash('sha256')
  .update(await readFile(archive))
  .digest('hex');
if (digest !== lock.sha256) {
  throw new Error(
    `SHA-256 mismatch: ${digest}; archive retained for diagnostics.`,
  );
}
const license = join(downloads, 'geogebra-license.html');
try {
  await readFile(license);
} catch {
  execFileSync(
    'curl',
    [
      '--fail',
      '--location',
      '--proto',
      '=https',
      '--max-time',
      '30',
      'https://www.geogebra.org/license',
      '-o',
      license,
    ],
    {stdio: 'inherit'},
  );
}
let receipt;
try {
  receipt = JSON.parse(
    await readFile(join(root, '.runtime/receipt.json'), 'utf8'),
  );
  if (!receipt || typeof receipt !== 'object') {
    throw new Error('Malformed existing runtime receipt; do not overwrite.');
  }
} catch (error) {
  if (!(error instanceof Error && error.code === 'ENOENT')) {
    throw error;
  }
  try {
    await lstat(join(root, '.runtime'));
    throw new Error('Existing runtime has no valid receipt; do not overwrite.');
  } catch (missing) {
    if (!(missing instanceof Error && missing.code === 'ENOENT')) {
      throw missing;
    }
    // 只有运行时目录和 receipt 都不存在才是首次准备。
  }
}
if (receipt) {
  if (
    receipt.sha256 !== digest ||
    receipt.version !== lock.version ||
    receipt.url !== lock.url
  ) {
    throw new Error('Existing runtime identity mismatch; do not overwrite.');
  }
  console.log(
    JSON.stringify({
      scope: 'runtime-preparation',
      reusedOwnVerifiedArchive: true,
      ...receipt,
    }),
  );
  process.exit(0);
}
// 先在独立目录解压和记录身份，完整准备后再提交运行时目录。
const temp = await mkdtemp(join(root, '.runtime-prepare-'));
try {
  execFileSync('unzip', ['-q', archive, '-d', temp]);
  await writeFile(
    join(temp, 'receipt.json'),
    JSON.stringify(
      {
        version: lock.version,
        url: lock.url,
        sha256: digest,
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
  await rename(temp, join(root, '.runtime'));
  console.log(
    JSON.stringify({
      scope: 'runtime-preparation',
      version: lock.version,
      sha256: digest,
      path: join(root, '.runtime'),
    }),
  );
} finally {
  await rm(temp, {recursive: true, force: true});
}
