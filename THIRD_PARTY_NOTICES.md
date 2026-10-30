# 第三方来源与运行时边界

GeoGebra 由 GeoGebra 提供，版权归相应权利人所有。官网：[GeoGebra](https://www.geogebra.org/)。许可依据为[官方许可页](https://www.geogebra.org/license)。运行时不随本骨架分发；不得把本工程的许可声明替代 GeoGebra 的条款。

采用官方离线 bundle，版本、URL 和 SHA-256 记录在 [runtime.lock.json](runtime.lock.json)。初始预期元数据参考相邻工程锁文件，本次已在教学工程独立下载官方包、计算摘要并确认一致；真实 applet 返回 5.4.932.1。准备脚本在解压前比较摘要，保留包内 README.txt 和全部内容，另保存官方许可页 HTML 快照。摘要不匹配必须停止，不得自动改锁。

2026-10-29 只读参考了 `../ggb-plugins/README.md`、`docs/ggb-plugins-design.md`、`scripts/setup-runtime.mjs` 和 `runtime.lock.json`，用于理解责任边界及摘要校验流程。本次没有复用源代码片段，没有复制其构建产物、依赖、运行时或用户产物。

官方自托管说明见 [GeoGebra Apps Embedding](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_Embedding/)。后续实现必须使用固定本地运行时，不回退到 latest CDN 或其他客户端缓存。TypeScript、Playwright 及其传递依赖的具体来源和完整性由 pnpm 锁文件记录，许可证保留在各自安装包中。

官方许可快照位于 `.runtime-download/geogebra-license.html`；每次实验复制到本次 output 目录，并保存包内 runtime-README.txt。完整解压包位于 `.runtime/`，这些产物均不随源码分发。来源及真实结果见[技术实验记录](docs/technical-experiment.md)。

请求结构验证使用 Ajv 8.20.0（MIT），官方说明见 [Ajv](https://ajv.js.org/)。精确包版本及完整性记录在 pnpm-lock.yaml，许可保留在安装包中。

开发风格检查使用 Google 维护的 [gts](https://github.com/google/gts) 7.0.0（Apache-2.0），依赖和许可随各安装包保留，版本及完整性记录在 pnpm-lock.yaml。
