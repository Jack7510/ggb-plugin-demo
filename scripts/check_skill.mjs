#!/usr/bin/env node
/**
 * @fileoverview 静态检查可分发 Skill 的 frontmatter、包内引用和 CLI 路径定位；
 * 不启动 GeoGebra，也不证明宿主会自动发现或安装该 Skill。
 */

import {execFileSync} from 'node:child_process';
import {existsSync, lstatSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = resolve(root, 'skills/ggb-demo-construction');
const skillFile = resolve(skillDir, 'SKILL.md');
const errors = [];
const checkedFiles = [];
let linkCount = 0;

function fail(message) {
  errors.push(message);
}
function inside(base, target) {
  const rel = relative(base, target);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep));
}
function walk(directory) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      fail(
        'Skill package must not contain symbolic links: ' +
          relative(root, path),
      );
    } else if (entry.isDirectory()) {
      walk(path);
    } else if (entry.isFile()) {
      checkedFiles.push(path);
    }
  }
}
function requireRegularFile(path, label) {
  if (!existsSync(path) || !lstatSync(path).isFile()) {
    fail('Missing regular file: ' + label);
    return false;
  }
  return true;
}
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    fail('SKILL.md must start with a frontmatter block');
    return {};
  }
  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const field = line.match(/^([a-z][a-z0-9_-]*):\s*(.+)$/);
    if (!field) {
      fail('Unsupported frontmatter line: ' + line);
      continue;
    }
    values[field[1]] = field[2].trim();
  }
  return values;
}
function checkLinks(file) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
    const raw = match[1].replace(/^<|>$/g, '');
    if (
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('#') ||
      raw.startsWith('mailto:')
    ) {
      continue;
    }
    linkCount += 1;
    const target = resolve(dirname(file), raw.split('#')[0]);
    if (!inside(root, target)) {
      fail(
        'Link escapes the package root: ' + relative(root, file) + ' -> ' + raw,
      );
    } else if (!existsSync(target)) {
      fail(
        'Broken package-relative link: ' + relative(root, file) + ' -> ' + raw,
      );
    }
  }
}
function checkForbiddenPaths(file) {
  const text = readFileSync(file, 'utf8');
  const rules = [
    [/\/Users\//, 'developer home path'],
    [/\/Applications\//, 'developer application path'],
    [/\/home\//, 'developer home path'],
    [/[A-Za-z]:\\/, 'Windows absolute path'],
    [/~\//, 'home-relative path'],
    [/\$HOME/, 'home variable path'],
    [/file:\/\//, 'file URL'],
    [/\.codex\/(?:plugins|skills)/, 'Codex cache path'],
    [/\.dsh\/(?:profiles|skills)/, 'DSH cache path'],
    [/ggb-plugins/, 'sibling plugin cache'],
    [/node_modules\/\.pnpm/, 'dependency cache path'],
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(text)) {
      fail('Forbidden ' + label + ' in ' + relative(root, file));
    }
  }
}

if (!requireRegularFile(skillFile, 'skills/ggb-demo-construction/SKILL.md')) {
  process.exitCode = 1;
} else {
  const text = readFileSync(skillFile, 'utf8');
  const frontmatter = parseFrontmatter(text);
  const expectedName = 'ggb-demo-construction';
  if (Object.keys(frontmatter).sort().join(',') !== 'description,name') {
    fail('Frontmatter must contain exactly name and description');
  }
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frontmatter.name ?? '') ||
    (frontmatter.name ?? '').length > 64
  ) {
    fail(
      'Frontmatter name must be lowercase-hyphenated and at most 64 characters',
    );
  }
  if (frontmatter.name !== expectedName) {
    fail('Frontmatter name must be ' + expectedName);
  }
  if (frontmatter.name !== skillDir.split(sep).at(-1)) {
    fail('Frontmatter name must match the skill directory name');
  }
  const description = frontmatter.description ?? '';
  if (description.length < 40 || description.length > 1024) {
    fail('Frontmatter description must be 40-1024 characters');
  }
  if (!/^Use when\b/i.test(description)) {
    fail('Frontmatter description must start with a use condition');
  }
  if (!/2D GeoGebra construction/i.test(description)) {
    fail('Frontmatter description must state the new 2D construction scope');
  }
  if (!/(GGB|verification artifacts)/i.test(description)) {
    fail(
      'Frontmatter description must mention the GGB or verification outputs',
    );
  }
  if (!/does not claim/i.test(description)) {
    fail('Frontmatter description must not overclaim unverified capabilities');
  }
  for (const token of [
    'doctor',
    'check',
    'build',
    'preview',
    'Playwright',
    'image understanding',
    'two automatic repair attempts',
    'Slider',
  ]) {
    if (!text.includes(token)) {
      fail('SKILL.md is missing workflow marker: ' + token);
    }
  }
  if (/Midpoint\s*\(/.test(text) || /A\s*=\s*\(\s*0\s*,\s*0\s*\)/.test(text)) {
    fail(
      'SKILL.md must not embed a single-problem triangle recipe; keep it in examples',
    );
  }

  for (const relativePath of [
    'SKILL.md',
    'references/request-and-cli.md',
    'references/report-reading.md',
    'references/installation.md',
    'examples/triangle.md',
    'examples/circle-inscribed-polygon.md',
  ]) {
    const path = resolve(skillDir, relativePath);
    requireRegularFile(path, relative(skillDir, path));
  }
  const setupDirectory = resolve(root, 'skills/setup');
  const setupSkill = resolve(setupDirectory, 'SKILL.md');
  const manifest = JSON.parse(
    readFileSync(resolve(root, 'plugin.json'), 'utf8'),
  );
  if (
    manifest.extensions?.['com.openai']?.onboardingSkill !==
    './skills/setup/SKILL.md'
  ) {
    fail('Plugin onboardingSkill must point to the packaged setup skill');
  }
  if (requireRegularFile(setupSkill, 'skills/setup/SKILL.md')) {
    const setup = parseFrontmatter(readFileSync(setupSkill, 'utf8'));
    if (setup.name !== 'setup' || !setup.description) {
      fail('Setup skill must declare its name and preparation scope');
    }
    walk(setupDirectory);
  }
  requireRegularFile(
    resolve(root, 'scripts/setup-plugin.mjs'),
    'scripts/setup-plugin.mjs',
  );
  requireRegularFile(
    resolve(root, 'dist/src/setup_plugin.js'),
    'dist/src/setup_plugin.js',
  );
  walk(skillDir);
  for (const file of checkedFiles) {
    checkForbiddenPaths(file);
    if (file.endsWith('.md')) {
      checkLinks(file);
    }
  }

  const cli = resolve(skillDir, '../../dist/src/cli.js');
  const expectedCli = resolve(root, 'dist/src/cli.js');
  if (cli !== expectedCli || !inside(root, cli)) {
    fail(
      'CLI path from the skill directory does not resolve inside the package',
    );
  }
  if (!requireRegularFile(cli, 'dist/src/cli.js')) {
    fail('Build the package before checking the skill CLI path');
  } else {
    try {
      const version = execFileSync(process.execPath, [cli, '--version'], {
        encoding: 'utf8',
        timeout: 10_000,
      }).trim();
      const packageVersion = JSON.parse(
        readFileSync(resolve(root, 'package.json'), 'utf8'),
      ).version;
      if (version !== packageVersion) {
        fail('CLI version does not match package.json: ' + version);
      }
      if (errors.length === 0) {
        console.log(
          'Skill static check passed: ' +
            relative(root, skillFile) +
            ' (CLI ' +
            version +
            ', ' +
            checkedFiles.length +
            ' files, ' +
            linkCount +
            ' links)',
        );
      }
    } catch (error) {
      fail('Resolved CLI did not execute: ' + String(error));
    }
  }

  if (!existsSync(resolve(skillDir, 'examples/triangle.md'))) {
    fail('Triangle example is missing from examples/');
  } else if (
    !/Midpoint\s*\(A\s*,\s*B\s*\)/.test(
      readFileSync(resolve(skillDir, 'examples/triangle.md'), 'utf8'),
    )
  ) {
    fail('Triangle example must contain the concrete Midpoint(A,B) recipe');
  }
  if (!existsSync(resolve(skillDir, 'examples/circle-inscribed-polygon.md'))) {
    fail('Slider polygon example is missing from examples/');
  } else if (
    !/Slider\s*\(/.test(
      readFileSync(
        resolve(skillDir, 'examples/circle-inscribed-polygon.md'),
        'utf8',
      ),
    )
  ) {
    fail('Slider polygon example must contain a concrete Slider(...) recipe');
  }
}

if (errors.length) {
  console.error('Skill static check failed:');
  for (const error of errors) {
    console.error(' - ' + error);
  }
  process.exitCode = 1;
}
