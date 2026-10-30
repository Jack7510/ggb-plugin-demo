/**
 * @fileoverview 静态检查可分发 Skill 的 frontmatter、包内引用和 CLI 路径定位。
 */

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';

const checker = fileURLToPath(
  new URL('../../scripts/check_skill.mjs', import.meta.url),
);

await test('skill package has valid frontmatter, references and CLI path', () => {
  const result = spawnSync(process.execPath, [checker], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Skill static check passed/);
});

await test('documented resolution keeps an explicit host CLI and locates its own package', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ggb-skill-resolution-'));
  try {
    const skillDir = join(
      directory,
      'skill package',
      'skills',
      'ggb-demo-construction',
    );
    const hostRoot = join(directory, 'host package');
    const hostCli = join(hostRoot, 'dist', 'src', 'cli.js');
    await mkdir(skillDir, {recursive: true});
    await mkdir(join(hostRoot, 'dist', 'src'), {recursive: true});
    await writeFile(hostCli, '');
    const bundledCli = resolve(skillDir, '../../dist/src/cli.js');
    await mkdir(resolve(bundledCli, '..'), {recursive: true});
    await writeFile(bundledCli, '');
    const document = await readFile(
      new URL(
        '../../skills/ggb-demo-construction/references/installation.md',
        import.meta.url,
      ),
      'utf8',
    );
    const block = document.match(/```sh\n([\s\S]*?)\n```/);
    assert.ok(
      block,
      'Installation must contain the authoritative resolution procedure',
    );
    // 执行文档原文的定位部分；空文件只是路径占位，不模拟 CLI/doctor 成功。
    const procedure = block[1]!.split('(cd "$WORKSPACE"')[0]!;
    const script =
      procedure
        .replace(
          'SKILL_DIR="<directory containing SKILL.md>"',
          'SKILL_DIR="$TEST_SKILL_DIR"',
        )
        .replace(
          'WORKSPACE="<user workspace>"',
          'WORKSPACE="$TEST_WORKSPACE"',
        ) + '\nprintf \'%s\\n%s\\n\' "$CLI" "$PACKAGE_ROOT"';
    for (const [override, cli, root] of [
      ['', bundledCli, resolve(skillDir, '../..')],
      [hostCli, hostCli, hostRoot],
    ]) {
      const result = spawnSync('/bin/sh', ['-c', script], {
        encoding: 'utf8',
        env: {
          ...process.env,
          GGB_CLI: override,
          TEST_SKILL_DIR: skillDir,
          TEST_WORKSPACE: directory,
        },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.stdout.trim().split('\n'), [cli, root]);
    }
    const relative = spawnSync('/bin/sh', ['-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GGB_CLI: 'relative/cli.js',
        TEST_SKILL_DIR: skillDir,
        TEST_WORKSPACE: directory,
      },
    });
    assert.equal(relative.status, 1);
    assert.match(relative.stderr, /absolute path/);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
