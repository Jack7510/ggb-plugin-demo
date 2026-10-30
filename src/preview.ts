/**
 * @fileoverview 先复核正式交付，再展示同一 GGB；预览持有自己的信号处理和退出清理。
 */

import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {EngineSession} from './browser.js';
import {readDelivery} from './delivery.js';
import {runtimeIdentity} from './runtime.js';
import {compareReload, verifyRequest} from './verify.js';
import {ToolError} from './errors.js';

/** 校验并加载同一 GGB；ready 表示可交互，closed 才表示资源已释放。 */
export async function preview(
  root: string,
  path: string,
  ready: (data: unknown) => void,
  outputRoot = join(process.cwd(), 'output'),
) {
  // 只有交付读取成功后才创建诊断目录；无效路径不应在调用方留下副作用。
  let diagnostics = '';
  function save(name: string, value: unknown) {
    if (!diagnostics) {
      return;
    }
    return writeFile(
      join(diagnostics, name),
      JSON.stringify(value, null, 2) + '\n',
    );
  }
  let session: EngineSession | undefined;
  let signalled = false;
  // 就绪前没有等待者；先记住取消意图，再在阶段边界检查，避免漏掉信号。
  let wake = () => {};
  function stop() {
    signalled = true;
    wake();
  }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('SIGHUP', stop);
  function assertNotCancelled() {
    if (signalled) {
      throw new ToolError('CANCELLED', 'Preview cancelled before ready');
    }
  }
  const exits: unknown[] = [];
  let failure: unknown;
  let result: unknown;
  let stage = 'delivery-integrity';
  /** 分别记录验证与展示会话的退出结果，不让后一会话掩盖前一次关闭失败。 */
  async function closeCurrent() {
    if (!session) {
      return;
    }
    const active = session;
    const cleanup = await active.close();
    exits.push({
      cleanup,
      browserSelection: active.browserSelection,
      requests: active.local?.requests ?? [],
      blocked: active.blocked,
      log: active.log,
    });
    session = undefined;
    if (!cleanup.ok) {
      throw new ToolError(
        'CLEANUP_FAILED',
        'Preview resources failed to close',
      );
    }
  }
  try {
    const delivery = await readDelivery(path);
    assertNotCancelled();
    await mkdir(outputRoot, {recursive: true});
    diagnostics = await mkdtemp(join(outputRoot, 'preview-'));
    const identity = await runtimeIdentity(root);
    if (
      identity.sha256 !== delivery.manifest.runtime.sha256 ||
      identity.version !== delivery.manifest.runtime.version
    ) {
      throw new ToolError(
        'RUNTIME_UNAVAILABLE',
        'Delivery and installed runtime differ',
      );
    }
    /** 两个会话均加载同一已核对的 GGB；绝不调用 request.program 重画。 */
    async function loadAndVerify() {
      await session!.launch();
      assertNotCancelled();
      await session!.freshApplet();
      assertNotCancelled();
      // 使用清单已核对的原始字节，而不是重新执行构造后得到的相似图形。
      await session!.loadGgb(delivery.ggb.toString('base64'));
      assertNotCancelled();
      const facts = await session!.snapshot();
      if (
        facts.engineVersion !== identity.version ||
        !verifyRequest(delivery.request, facts).ok ||
        !compareReload(delivery.after, facts) ||
        session!.blocked.length
      ) {
        throw new ToolError(
          'PREVIEW_ERROR',
          'Delivered GGB failed live re-verification',
        );
      }
      return facts;
    }
    // 预览独占信号处理，防止 Playwright 默认退出进程而绕过 finally。
    stage = 'headless-reverification';
    session = new EngineSession(root, 'engine', true, false);
    const facts = await loadAndVerify();
    await save('reverified.json', facts);
    await session.page!.screenshot({
      path: join(diagnostics, 'reverified.png'),
      fullPage: true,
    });
    // 先关闭 headless 验证资源，再创建用户可见窗口，保持两阶段责任独立。
    await closeCurrent();
    assertNotCancelled();
    stage = 'visible-preview';
    session = new EngineSession(root, 'engine', false, false);
    await loadAndVerify();
    const active = session;
    const closed = new Promise<void>(resolve => {
      wake = resolve;
      active.page!.once('close', () => resolve());
      active.browser!.once('disconnected', () => resolve());
      if (signalled || active.page!.isClosed()) {
        resolve();
      }
    });
    assertNotCancelled();
    // ready 只表示可交互；调用方仍须等待 closed 和最终进程退出码。
    ready({
      event: 'ready',
      delivery: delivery.directory,
      ggbSha256: delivery.ggbSha256,
      diagnostics,
      exit: 'Close the dedicated preview window or press Ctrl+C; resources are closed before exit.',
    });
    await closed;
    result = {
      event: 'closed',
      delivery: delivery.directory,
      ggbSha256: delivery.ggbSha256,
      diagnostics,
    };
  } catch (error) {
    failure = error;
  } finally {
    try {
      await closeCurrent();
    } catch (error) {
      failure = error;
    }
    // 当前预览结束即移除自身监听，不能把处理器遗留给后续调用。
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    process.off('SIGHUP', stop);
    await save('cleanup.json', {sessions: exits});
  }
  if (failure) {
    const error =
      failure instanceof ToolError
        ? failure
        : new ToolError('PREVIEW_ERROR', String(failure));
    await save('failure.json', {stage, code: error.code, error: error.message});
    throw new ToolError(error.code, error.message, diagnostics || undefined);
  }
  await save('result.json', {ok: true, result});
  return result;
}
