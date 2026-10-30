/** @fileoverview 检查实际归档的隔离边界、完整性与身份不匹配时的拒绝行为。 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {packagePlugin} from '../src/package_plugin.js';
import {sha256} from '../src/runtime.js';

await test('Codex archive contains its compiled tool and skill without borrowed runtime or client artifacts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ggb-package-test-'));
  const root = fileURLToPath(new URL('../../', import.meta.url));
  try {
    const result = await packagePlugin(root, directory);
    const entries = execFileSync('unzip', ['-Z1', result.archive], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n');
    assert.ok(entries.includes('.agents/plugins/marketplace.json'));
    assert.ok(entries.includes('plugins/ggb-plugin-demo/dist/src/cli.js'));
    assert.ok(
      entries.includes('plugins/ggb-plugin-demo/scripts/setup-plugin.mjs'),
    );
    assert.ok(
      entries.includes('plugins/ggb-plugin-demo/skills/setup/SKILL.md'),
    );
    const manifest = JSON.parse(
      execFileSync(
        'unzip',
        ['-p', result.archive, 'plugins/ggb-plugin-demo/plugin.json'],
        {encoding: 'utf8'},
      ),
    );
    assert.equal(
      manifest.extensions['com.openai'].onboardingSkill,
      './skills/setup/SKILL.md',
    );

    assert.ok(
      entries.includes(
        'plugins/ggb-plugin-demo/skills/ggb-demo-construction/SKILL.md',
      ),
    );
    assert.ok(
      entries.includes('plugins/ggb-plugin-demo/scripts/setup_runtime.mjs'),
    );
    assert.ok(
      entries.every(
        name =>
          !/(^|\/)(?:node_modules|\.runtime[^/]*|\.pnpm-store|output|\.git|\.archify)(?:\/|$)/.test(
            name,
          ),
      ),
    );
    assert.equal(sha256(await readFile(result.archive)), result.sha256);
    const receipt = JSON.parse(
      execFileSync('unzip', ['-p', result.archive, 'package-receipt.json'], {
        encoding: 'utf8',
      }),
    ) as {files: Record<string, string>};
    for (const name of [
      'dist/src/cli.js',
      'pnpm-lock.yaml',
      'runtime.lock.json',
      'plugin.json',
    ]) {
      const bytes = execFileSync('unzip', [
        '-p',
        result.archive,
        'plugins/ggb-plugin-demo/' + name,
      ]);
      assert.equal(sha256(bytes), receipt.files[name]);
    }
    const catalog = JSON.parse(
      execFileSync(
        'unzip',
        ['-p', result.archive, '.agents/plugins/marketplace.json'],
        {encoding: 'utf8'},
      ),
    );
    assert.equal(catalog.name, 'ggb-plugin-demo-local');
    assert.equal(catalog.plugins[0].source.path, './plugins/ggb-plugin-demo');
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

await test('mismatched manifest identity is refused before creating a package', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ggb-package-invalid-'));
  try {
    await writeFile(
      join(root, 'plugin.json'),
      JSON.stringify({name: 'other', version: '0.0.0'}),
    );
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'ggb-plugin-demo',
        version: '0.0.0',
        private: true,
      }),
    );
    await assert.rejects(
      packagePlugin(root, join(root, 'output')),
      /identity\/version/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
