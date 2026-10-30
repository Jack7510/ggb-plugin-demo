/**
 * @fileoverview 只检查系统 Chrome 与本地占位页，不将浏览器可用误报为 GeoGebra 核验通过。
 */

import {chromium} from 'playwright';

// System Chrome is an explicit prerequisite; do not fall back to another client's cache.
let browser;
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    timeout: 30_000,
  });
  const page = await browser.newPage();
  await page.goto(new URL('../viewer/index.html', import.meta.url).href);
  const title = await page.title();
  if (title !== 'ggb-plugin-demo scaffold') {
    throw new Error(`Unexpected viewer title: ${title}`);
  }
  const version = browser.version();
  await browser.close();
  browser = undefined;
  console.log(
    JSON.stringify({
      ok: true,
      scope: 'browser-only',
      browserVersion: version,
      geogebra: 'not-tested',
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({ok: false, scope: 'browser-only', error: String(error)}),
  );
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
}
