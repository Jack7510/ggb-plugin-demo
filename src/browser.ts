/**
 * @fileoverview 管理一次调用拥有的专用浏览器资源，以及可信页面到 GeoGebra 的桥接。
 */

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import {startServer} from './server.js';
import {detectBrowser, type BrowserSelection} from './browser_selection.js';
import {ToolError} from './errors.js';
import type {Request} from './request.js';
import type {Facts} from './verify.js';
import type {PixelPoint, ViewProperties} from './interaction.js';

// 仅固定 engine viewer 提供这些方法；声明桥接类型，避免双重类型断言。
declare global {
  interface Window {
    runRequest(request: Request): void;
    loadDiskGgb(value: string): Promise<void>;
    engine: {getVisible(label: string): boolean};
  }
}

/** 为页面桥接提供 Node 侧超时，避免引擎无响应时永远无法进入清理。 */
export async function bounded<T>(
  operation: Promise<T>,
  milliseconds = 35_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // 超时只结束等待，不等于底层操作已停止；调用者仍须 finally 关闭会话。
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ToolError('TIMEOUT', 'Engine operation timed out')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    // 成功操作也要取消定时器，避免它继续持有 Node 进程。
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * 拥有一次执行的服务、浏览器、上下文和页面；调用者必须在 finally 中关闭。
 * launch 先于 freshApplet；采集、执行及加载只在 freshApplet 成功后调用。
 */
export class EngineSession {
  browser: Browser | undefined;
  browserSelection: BrowserSelection | undefined;
  context: BrowserContext | undefined;
  page: Page | undefined;
  local: Awaited<ReturnType<typeof startServer>> | undefined;
  log: unknown[] = [];
  blocked: string[] = [];
  constructor(
    private readonly root: string,
    private readonly mode: 'engine' | 'experiment' = 'engine',
    private readonly headless = true,
    private readonly handleSignals = true,
    private readonly recordVideoDir?: string,
  ) {}
  /** 仅启动本次资源，不附着到用户已有浏览器或其他客户端的服务。 */
  async launch() {
    this.browserSelection = detectBrowser();
    this.local = await startServer(this.root, this.mode);
    this.browser = await chromium.launch({
      executablePath: this.browserSelection.executablePath,
      headless: this.headless,
      timeout: 30_000,
      // preview 自己管理信号，其他入口保留 Playwright 的默认处理。
      handleSIGINT: this.handleSignals,
      handleSIGTERM: this.handleSignals,
      handleSIGHUP: this.handleSignals,
    });
  }
  /** 先关闭原上下文，再验证新 applet 为空，避免重载复用旧内存状态。 */
  async freshApplet() {
    if (this.page) {
      await this.page.close();
      this.page = undefined;
    }
    if (this.context) {
      await this.context.close();
      this.context = undefined;
    }
    this.context = await this.browser!.newContext({
      viewport: {width: 1100, height: 760},
      serviceWorkers: 'block',
      acceptDownloads: false,
      // 仅明确标注的测试诊断使用录像；正式 build/preview 不传此目录。
      ...(this.recordVideoDir
        ? {
            recordVideo: {
              dir: this.recordVideoDir,
              size: {width: 1100, height: 760},
            },
          }
        : {}),
    });
    // 在页面导航前安装限制，连首次加载也不能绕过同源资源边界。
    await this.context.route('**/*', async route => {
      const url = route.request().url();
      if (
        new URL(url).origin === this.local!.origin &&
        route.request().method() === 'GET'
      ) {
        await route.continue();
      } else {
        this.blocked.push(url);
        await route.abort('blockedbyclient');
      }
    });
    await this.context.routeWebSocket('**/*', async socket => {
      this.blocked.push(socket.url());
      await socket.close();
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(60_000);
    this.page.on('console', message =>
      this.log.push({type: message.type(), message: message.text()}),
    );
    this.page.on('pageerror', error => this.log.push({error: String(error)}));
    await this.page.goto(this.local!.origin);
    await this.page.waitForFunction('window.ready === true');
    const facts = await this.snapshot();
    if (facts.objects.length !== 0) {
      throw new ToolError('ENGINE_ERROR', 'Fresh applet is not empty');
    }
    return facts;
  }
  /** 仅向固定页面桥接传递已验证的请求数据，不把请求拼成 JavaScript。 */
  async run(request: Request) {
    await bounded(
      this.page!.evaluate(data => {
        window.runRequest(data);
      }, request),
    );
  }
  /** 采集原生事实；此方法不作通过/失败判定。 */
  async snapshot(): Promise<Facts> {
    return bounded(this.page!.evaluate('window.snapshot()') as Promise<Facts>);
  }
  /** 保存引擎原始 XML，供重载差异分析和失败诊断使用。 */
  async xml(): Promise<string> {
    return bounded(
      this.page!.evaluate('window.engine.getXML()') as Promise<string>,
    );
  }
  /** 调用原生导出回调；返回值由上层写盘并检查，绝不手工生成 GGB。 */
  async exportGgb(): Promise<string> {
    return bounded(
      this.page!.evaluate('window.exportGgb()') as Promise<string>,
    );
  }
  /** 加载调用者从磁盘交付读取的字节，不按请求重建图形。 */
  async loadGgb(base64: string) {
    await bounded(
      this.page!.evaluate(async data => window.loadDiskGgb(data), base64),
    );
  }
  /** 读取当前二维画布的实际可视范围和像素比例，供真实鼠标定位。 */
  async viewProperties(): Promise<ViewProperties> {
    return bounded(
      this.page!.evaluate(
        'JSON.parse(window.engine.getViewProperties(1))',
      ) as Promise<ViewProperties>,
    );
  }
  /** 原生可见性属于拖动前置事实；隐藏点不能作为可拖动对象。 */
  async visible(label: string): Promise<boolean> {
    return bounded(
      this.page!.evaluate(
        point => window.engine.getVisible(point),
        label,
      ) as Promise<boolean>,
    );
  }
  /**
   * 在真实画布上按下、连续移动并松开鼠标；不调用 SetCoords 或赋值。
   * 即使移动失败也会尝试松开按键，证据不完整时由调用方拒绝交付。
   */
  async drag(start: PixelPoint, target: PixelPoint, steps = 24) {
    const page = this.page!;
    let down = false;
    let up = false;
    try {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      down = true;
      await page.mouse.move(target.x, target.y, {steps});
    } finally {
      try {
        await page.mouse.up();
        up = true;
      } catch {
        // 页面/浏览器已退出时松开不可能成功；保留 up=false 并让门禁失败。
      }
    }
    // 等待引擎完成 mouseup 后的原生重算，再采集 after 事实。
    await page.waitForTimeout(50);
    return {down, up, steps};
  }
  /** 逐项关闭全部资源；单个关闭失败不能跳过其他资源的释放。 */
  async close() {
    // 不采用遇错即停的关闭方式，否则页面关闭失败会遗留浏览器或服务。
    const statuses: Record<string, string | boolean> = {};
    for (const [name, action] of [
      [
        'page',
        async () => {
          if (this.page) {
            await this.page.close();
          }
        },
      ],
      [
        'context',
        async () => {
          if (this.context) {
            await this.context.close();
          }
        },
      ],
      [
        'browser',
        async () => {
          if (this.browser) {
            await this.browser.close();
          }
        },
      ],
      [
        'server',
        async () => {
          if (this.local) {
            await new Promise<void>((resolve, reject) => {
              this.local!.server.close(error =>
                error ? reject(error) : resolve(),
              );
              this.local!.server.closeAllConnections();
            });
          }
        },
      ],
    ] as const) {
      try {
        await action();
        statuses[name] = 'closed-or-not-created';
      } catch (error) {
        statuses[name] = String(error);
      }
    }
    statuses.browserDisconnected = !this.browser?.isConnected();
    statuses.serverStopped = !this.local?.server.listening;
    const ok = Object.values(statuses).every(
      value => value === 'closed-or-not-created' || value === true,
    );
    return {ok, ...statuses};
  }
}
