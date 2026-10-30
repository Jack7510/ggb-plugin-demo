# 工具：把请求变成可复核的交付

本页是当前 CLI 的教学摘要。组件责任与流程以 [arch.md](arch.md) 为准，
命令和错误语义以 [demo-contract.md](demo-contract.md) 为准。

## 一句话职责

TypeScript CLI 用 Playwright 驱动固定官方 GeoGebra 运行时，收集原生事实，
执行核验并管理资源。GeoGebra 解释数学命令；CLI 根据事实执行交付门禁。

## 四个入口怎样分工

| 命令 | 讲解重点 |
| --- | --- |
| doctor | 真正加载 applet 并构造原生点，确认运行时就绪；不证明题目成立 |
| check --request | 只检查请求结构、引用、容量与副作用边界；不运行数学核验 |
| build --request | 构造、逐条件核验、导出、独立重载、适用拖动与清理，最后提交交付 |
| preview --delivery | 复核完整交付，再加载同一份 GGB 字节供用户交互 |

## 沿代码指出五个关键细节

1. **运行时身份可核对。** [runtime.ts](../src/runtime.ts) 核对官方压缩包摘要和
   receipt；[锁文件](../runtime.lock.json) 记录固定版本与来源。解压目录尚未逐文件审计。
2. **执行环境有边界。** [browser.ts](../src/browser.ts) 创建专用浏览器资源，限制
   为本次同源 GET；[engine.js](../viewer/engine.js) 是受信任桥接，请求不是用户 JavaScript。
3. **核验读取原生事实。** [verify.ts](../src/verify.ts) 检查类型、定义状态、原生依赖、
   布尔探针与样式。静态 M=(3,0) 即使画面正确，也不能满足 Midpoint 的依赖要求。
4. **重载与拖动使用磁盘文件。** [pipeline.ts](../src/pipeline.ts) 丢弃原上下文，
   在空 applet 中读取导出的 GGB；每个交互样本再次独立加载。
   [interaction.ts](../src/interaction.ts) 核对真实鼠标命中、位移、关系及前后证据。
5. **清理属于成功条件。** 管线在 finally 关闭资源；全部门禁和完整交付校验通过后，
   才重命名暂存目录提交到独占 delivery 路径。失败保留诊断，重名不覆盖。

## 屏幕上展示什么

打开 pipeline 的导出、freshApplet、磁盘 readFile、拖动、finally 和 rename 位置，
再展示实际交付中的 verification.json、manifest.json、cleanup.json。
产物路径从本次命令返回值取得，不把历史路径当成新结果。

预览先发送 ready；关闭窗口或 Ctrl+C 后，观察 closed、退出码和清理记录。
ready 只表示可交互。具体协议见[契约](demo-contract.md#preview-的完整性与生命周期)。

## 留给观众的一句话

> 交付建立在原生构造、独立重载、交互证据和资源关闭上。

真实样本与测试记录见 [acceptance.md](acceptance.md)；build 完整取消协议仍待实现。
