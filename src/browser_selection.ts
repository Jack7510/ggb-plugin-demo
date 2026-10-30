/** @fileoverview 只检测系统 Chrome/Edge；安装器与实际执行共用选择结果，不下载浏览器。 */
import {spawnSync} from 'node:child_process';
import {accessSync, constants, realpathSync} from 'node:fs';
import {delimiter, join, resolve} from 'node:path';

/** 只允许受支持的浏览器品牌，不能用环境变量注入任意执行路径。 */
export interface BrowserCandidate {
  readonly channel: 'chrome' | 'msedge';
  readonly executablePath: string;
}
/** 记录真实系统路径和版本；此记录不替代真实 applet smoke。 */
export interface BrowserSelection extends BrowserCandidate {
  readonly version: string;
}
/** 按品牌优先级枚举已知系统位置与 PATH，不搜索 Playwright 或其他客户端缓存。 */
export function systemBrowserCandidates(): BrowserCandidate[] {
  const candidates: BrowserCandidate[] = [];
  function add(channel: BrowserCandidate['channel'], path: string) {
    candidates.push({channel, executablePath: resolve(path)});
  }
  if (process.platform === 'darwin') {
    for (const base of [
      '/Applications',
      join(process.env.HOME ?? '/', 'Applications'),
    ]) {
      add(
        'chrome',
        join(base, 'Google Chrome.app/Contents/MacOS/Google Chrome'),
      );
      add(
        'msedge',
        join(base, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
      );
    }
  } else if (process.platform === 'win32') {
    for (const base of [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      process.env.LOCALAPPDATA,
    ]) {
      if (base) {
        add('chrome', join(base, 'Google/Chrome/Application/chrome.exe'));
        add('msedge', join(base, 'Microsoft/Edge/Application/msedge.exe'));
      }
    }
  }
  for (const base of (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)) {
    for (const name of process.platform === 'win32'
      ? ['chrome.exe']
      : ['google-chrome', 'google-chrome-stable']) {
      add('chrome', join(base, name));
    }
    for (const name of process.platform === 'win32'
      ? ['msedge.exe']
      : ['microsoft-edge', 'microsoft-edge-stable']) {
      add('msedge', join(base, name));
    }
  }
  return candidates.sort(
    (a, b) => Number(a.channel === 'msedge') - Number(b.channel === 'msedge'),
  );
}
/** 检查真实可执行文件及版本，默认优先 Chrome，缺少 Chrome 时选择 Edge。 */
export function detectBrowser(
  candidates = systemBrowserCandidates(),
): BrowserSelection {
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      accessSync(candidate.executablePath, constants.X_OK);
      const result = spawnSync(candidate.executablePath, ['--version'], {
        encoding: 'utf8',
        timeout: 5_000,
      });
      const version = result.stdout.trim();
      const brand =
        candidate.channel === 'chrome'
          ? /(?:Google Chrome|Chromium)\s+\d/
          : /Microsoft Edge\s+\d/;
      if (result.status !== 0 || !brand.test(version)) {
        throw new Error('Version probe failed');
      }
      return {
        ...candidate,
        executablePath: realpathSync(candidate.executablePath),
        version,
      };
    } catch (error) {
      // 不存在的候选路径是正常探测结果；保留原因，全部失败时给出诊断。
      errors.push(candidate.executablePath + ': ' + String(error));
    }
  }
  throw new Error(
    'No supported system Chrome/Edge found. ' + errors.join('; '),
  );
}
