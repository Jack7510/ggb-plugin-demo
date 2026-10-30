# 验收证据与实际运行记录

本文件只记录实际运行证据、日期和产物路径，不定义需求、契约或流程。需求见
[requirements.md](requirements.md)，CLI/请求契约见 [demo-contract.md](demo-contract.md)，
架构见 [arch.md](arch.md)。固定三角形技术实验的历史快照见
[technical-experiment.md](technical-experiment.md)，Skill 维护者检查见
[skill-development.md](skill-development.md)。

以下路径是运行快照，不是规范文件名。新的运行必须使用交付 JSON/目录中的实际值，
不得把本文件的旧路径当作当前结果。

## 2026-10-30 setup 与 onboarding 补齐

本段记录 0.0.1 的新验证，不覆盖下方 0.0.0 历史安装或产物。
操作与错误语义见 [Codex 安装契约](codex-installation.md)。

- 已实现稳定入口 `scripts/setup-plugin.mjs`、安装副本资源检查、共享 Chrome/Edge
  检测、包内 setup Skill 与官方 `extensions.com.openai.onboardingSkill` 声明。
  本机 Node 26.5.1、pnpm 11.7.0、Codex CLI 0.165.0；未安装或升级全局依赖。
- 本地新包为 `output/packages/codex-package-YM5RDz/ggb-plugin-demo-0.0.1-codex.zip`，
  SHA-256 为 `a2b8499c8d9420ded3046af74a25879f38543c98742fd17a60fe766e232019a0`。
  收据记录基线 3e696cf、工作区有改动；它是当次打包快照，后补的本节记录不在该快照内。
  已核对安装副本全部 110 个包文件与收据一致。
- 新持久来源为 `/Users/lijunqiang1/.codex/local-marketplaces/ggb-plugin-demo-0.0.1-YM5RDz`；
  实际安装根为 `/Users/lijunqiang1/.codex/plugins/cache/ggb-plugin-demo-local/ggb-plugin-demo/0.0.1`。
  同名来源不能重复 add；原生命令先移除本插件的旧来源注册，再注册新来源并安装。
  旧来源目录、0.0.0 安装、历史包和用户产物保留，其他插件未修改。
- 新副本首次执行 `node <安装根>/scripts/setup-plugin.mjs --workspace /private/tmp/ggb-demo-setup-YM5RDz`
  返回 ready、退出 0。自有 pnpm store 的安装日志为 reused=0、downloaded=7，
  ajv 8.20.0 和 Playwright 1.64.1 均解析到本副本 node_modules。
  未复制相邻样板工程、开发目录或其他客户端缓存。
- 固定官方 GeoGebra 5.4.932.1 在新副本独立下载；运行时 SHA-256 为
  `c139f3edb51c004ec67d83226a1f1215486f8559ad98ee37e9e775aac278e96e`，
  许可 SHA-256 为 `a7b6dcea86438aeab4958ee4193b9dcedf36ade6efcef29a976a47967e6deabd`。
  runtime.lock 与真实 doctor 结果记录版本、来源 URL、摘要和许可 URL；
  许可快照保存在安装根 `.runtime-download/geogebra-license.html`。
- 实际浏览器为 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，
  版本 156.0.8078.74。首次真实 applet smoke 证据在该 workspace 的
  `output/doctor-oDR21H`；安装诊断位于安装根 `.setup/run-uy3Gh3`。
  点事实和截图均来自真实引擎；cleanup.ok、browserDisconnected、serverStopped 全部 true。
- 同一副本再次 setup 复用自身资源并重新运行真实 doctor：诊断 `.setup/run-8DlZXF`，
  新证据 `output/doctor-nLJf6V`，退出 0，资源清理通过，setup 排他锁已释放。
- 失败路径：将专用 doctor workspace 设为只读，doctor 在创建 output 时收到 EACCES，
  setup 退出 1、stdout 为空、最终错误 stage=doctor；未输出 ready，没有本次 result.json。
  `.setup/run-Sx5fBW/failure.json` 保留结构化诊断，权限随后恢复，原资源未删除。
  该反例发生在 applet 启动前，不冒充引擎内部 smoke 失败注入。
- 自动测试还验证依赖版本冲突、外部资源软链接、错误压缩包摘要、损坏 receipt、
  安装根内 workspace、非法参数，以及浏览器缺失或版本探测失败；不匹配资源保留。
  Edge 回退只用版本输出夹具验证选择逻辑，没有真实 Edge applet 证据；Windows/Linux 未实机验证。
- 原生 app-server 的 plugin/read 已解析 onboardingSkill 为 `ggb-plugin-demo:setup`；
  skills/list 在仓库外 workspace 和本仓库均发现 enabled=true 的 setup 与构图 Skill，
  路径属于 0.0.1 安装副本，没有解析错误。证据保存于
  `/private/tmp/ggb-demo-setup-YM5RDz/host-discovery-probe.json`。
- **onboarding UI 未验证**：Computer Use 拒绝访问 `com.openai.codex`，没有观察到按钮或触发过程。
  上述备用脚本已真实运行成功；不等同于 UI 入口可见或用户经 UI 初始化通过。
- `pnpm build`、`pnpm lint`（零告警）、`pnpm check:skill`（7 文件、24 链接）通过；
  定向 setup/package/skill 测试 8 项通过。
  `GGB_INTEGRATION=1 node --test dist/tests/*.test.js`：30 项全部通过，无跳过；
  包含真实构建、独立重载、20 次真实拖动、反例拒绝、交付完整性与 preview 退出。
  集成 workspace 保留于
  `/private/var/folders/72/9wygjhs545jg7k3w1q8ttyj8w97lsy/T/ggb-demo-integration-9aLiAv`。
- 文档与 Skill 的相对链接目标存在，`git diff --check` 通过；
  本轮新增 Mermaid 图只做静态核对，未做渲染验收。
- Skill 创建器的 `quick_validate.py` 因本机缺少 Python yaml 模块而未运行成功；
  未安装全局依赖来绕过。项目静态检查和上述 Codex 原生解析已通过。

本轮没有公开发布，没有验证 DSH、新会话模型驱动首题、完整双宿主独立安装、
运行时逐文件审计或完整强制取消协议。安装资源隔离与原生发现证据不能替代这些门禁。

## 2026-10-30 Codex 本地包与安装

本段是用户追加授权后的新记录，不改写此前“未安装”的历史结论。

- 本机 Codex CLI 0.165.0、Node 26.5.1、pnpm 11.7.0；使用根 portable
  plugin.json，经原生 marketplace add 与 plugin add 安装，没有手写全局配置。
- 插件 `ggb-plugin-demo@ggb-plugin-demo-local`，版本 0.0.0，原生列表显示
  installed=true、enabled=true。其他来源与插件未修改。
- 归档为 `output/packages/codex-package-AIUO6j/ggb-plugin-demo-0.0.0-codex.zip`，
  SHA-256 为 `fbbf4a4a1d2213217be52b2fe7b9dc08ace0a098ac2020855e781d9253331304`。
  ZIP 带 101 个插件文件的摘要收据，记录基线提交 3e696cf 和工作区有改动。
  它包含本批未提交打包实现，不能称为纯 3e696cf 提交归档。
- 持久来源根：`/Users/lijunqiang1/.codex/local-marketplaces/ggb-plugin-demo-0.0.0-AIUO6j`。
  实际安装根：`/Users/lijunqiang1/.codex/plugins/cache/ggb-plugin-demo-local/ggb-plugin-demo/0.0.0`。
  从 ZIP 解压注册，没有把来源指向开发目录。
- 归档不带 node_modules、运行时、其他客户端缓存或用户产物。安装根用新的
  .pnpm-store 执行 prod/frozen-lockfile/ignore-scripts 安装；pnpm 输出 reused=0、
  downloaded=7。依赖 realpath 均位于本安装根。
- 运行时在安装根从固定官方地址独立下载，SHA-256 与锁一致，许可单独保存。
  未复制样板仓库、开发目录或另一个客户端的依赖与运行时。
- 仓库外验收 workspace：`/private/tmp/ggb-demo-codex-install-AIUO6j`。
  其中 installation-verification.json 保存最终结构化记录；全部 101 个插件文件
  与归档来源摘要一致，安装根 output 无新增。
- 安装副本 doctor 真实 applet smoke 通过；完整 triangle.json 交付到该 workspace 的
  `output/delivery-jETWrK/delivery`。geometry、appearance、dragA 全部 passed，
  contentEqual=true，mouseInteraction=verified，资源关闭通过。
- 从安装副本运行静态中点反例，得到 VERIFICATION_FAILED，保留诊断，cleanup.ok=true。
  同文件 preview 在 ready 后 SIGINT，返回 closed、退出 0，两会话清理通过。
- 新 Codex app-server 在仓库外通过 skills/list 返回
  `ggb-plugin-demo:ggb-demo-construction`，路径属于实际安装副本，enabled=true，
  无对应解析错误；plugin/read 同样确认清单与 Skill。
- 首次验证器只按短名 ggb-demo-construction 过滤，误报发现为空。保留原始
  skill-discovery.json 与 host-discovery-probe.json；按原生带命名空间名称核对后通过。
  该修正没有修改插件，也没有重跑已通过的引擎场景。
- 构建、零告警 lint、Skill 静态检查通过；新增 2 项打包测试通过。
  `node --test dist/tests/*.test.js` 为 26 项：25 passed、1 skipped；完整引擎集成
  测试默认跳过，本轮使用上述实际安装副本的独立引擎验收补充安装路径证据。

本段证明本机 Codex 注册、启用、原生 Skill 发现和安装副本 CLI 可用。没有运行模型
驱动的新会话自然语言首题；没有通过挂载或移除方式使开发目录物理不可访问。
因此不把这次隔离准备与路径检查等同于全部独立安装门禁，也不宣布 A01 双宿主完成。
DSH、build 完整取消协议、公开发布仍未验收。

## 2026-10-30 一致性修复验证

以下为本轮实际执行结果。旧运行记录与仓库历史 output 均保留。

- `pnpm build` 和 `pnpm lint` 通过，lint 零告警。
- 定向执行 request、delivery 和 skill 测试，11 项全部通过。
  最后一次测试字符串格式调整后，又构建并执行 skill 测试，2 项全部通过。
- `GGB_INTEGRATION=1 node --test dist/tests/*.test.js`：24 项全部通过，无跳过。
  真实引擎集成包含 9 个构建场景；预期失败也必须匹配错误码并留下成功清理记录。
- 本轮临时 workspace 保留于
  `/private/var/folders/72/9wygjhs545jg7k3w1q8ttyj8w97lsy/T/ggb-demo-integration-d43uH8`。
  以下路径均相对该 workspace，不是安装包输出路径。
- 20 样本请求交付到 `output/delivery-0NVEx9/delivery`；样本 id 为
  `move_A_0` 至 `move_A_19`，均独立加载同一磁盘 GGB 后真实拖动并通过。
  清单含 206 项，requirements 全部 passed；GGB SHA-256 为
  `19cec733abf6ee091a25b49231a5b40881ddc1d67f8bcdb53c46499b52e6b957`。
- 在真实交付副本上逐项删除 206 个必需文件，每次同步删除清单项；
  每次都收到 `Missing required delivery file` 拒绝，故障注入副本随后删除。
- 同文件预览记录在 `output/preview-c7Fv59`：ready 后 SIGINT，随后 closed，退出 0。
  headless 与可见会话的 cleanup.ok、browserDisconnected、serverStopped 均为 true。
  本轮所有成功构建 cleanup.ok=true、blocked=[]；安装包 output 没有新增条目。
- 安装定位测试直接执行 installation 文档中的 shell 定位步骤，覆盖带空格路径、
  默认 CLI、显式绝对 GGB_CLI 和相对路径拒绝；没有安装宿主或扫描客户端缓存。
- 文档与 Skill 的 64 个相对链接目标存在；Mermaid 只做静态核对，未渲染。

A11 仍为部分验证：以上不是 build 完整信号取消或端到端超时清理的验收证据。
独立安装、宿主发现与发布仍未验收。

## v2 完整三角形与拖动

- 完整案例 [examples/triangle.json](../examples/triangle.json) 正式交付到
  `output/delivery-mZrXk4/delivery`：初态与重载各 13 项检查/样式通过，
  requirements 三条全部 passed；交互样本 `moveA` 为 passed，A 从 (0,0) 真实鼠标
  移动到 (-1,1)，目标误差 0 px，拖动后 M=(2.5,0.5)、parents=[A,B]、
  CM parents=[C,M]，M/CM 仍为 #FF0000，点名可见，`nondegenerate` 与
  `midpointRelation` 原生布尔为 1。
- 每个样本先证明新 applet 对象数为 0，再重新读取同一 `construction.ggb`
  （SHA-256 一致）加载；`interaction-moveA-before/after.json` 和对应 PNG 保存于
  交付目录，`readDelivery` 从事实重新计算检查、位移、依赖与 requirements。
- 静态中点反例 [examples/triangle-counterexample.json](../examples/triangle-counterexample.json)
  在 `output/.build-QOzaLP` 被依赖门禁拒绝：初始 midpoint 检查 failed，实际
  M independent=true、parents=[]、coordinates=[3,0]，因此未进入拖动，没有正式交付。
  失败目录保留，不删除、不改写。
- 反例修复为 `Midpoint(A,B)` 后正式交付到 `output/delivery-e20C54/delivery`；
  `pnpm demo:counterexample` 的总结保存到
  `output/demo-counterexample-yIcK3p/summary.json`。退出 0 只表示预期拒绝被观测，
  不是错误构图成功。
- 连续拖动补录诊断 `output/diagnostic-drag-CCyG3F/` 由 `pnpm demo:drag-video`
  产生，含真实鼠标拖动录像、前后截图和 `NOT_A_DELIVERY.json`；不进入正式交付。
- 完整交付 `output/delivery-mZrXk4/delivery` 的 preview 以同一 GGB 字节完成
  headless 复核和可见窗口加载，ready 后发送 SIGINT，返回 closed、退出 0；
  `output/preview-GZnLrh/cleanup.json` 两个会话 cleanup.ok=true、
  browserDisconnected=true、serverStopped=true，blocked=[]。

## v2 滑块正多边形

- 请求 [examples/circle-inscribed-polygon.json](../examples/circle-inscribed-polygon.json)
  使用 `n=Slider(3,12,1,1,200,false,true,false,false)` 和
  `poly=Polygon(A,B,n)`；初始 n=3，`B=Rotate(A,2*pi/n,O)`。
- 交付 `output/delivery-qsDDjq/delivery`，GGB SHA-256
  `3ade36b6db3ed6d6b5f658206a3e0f84be61c2bae3dfbe121f9ae111f306cde9`。
- initial 与 reloaded 各 14 项检查通过，requirements 三条全部 passed。
- `sides` 检查的实际 fact 记录
  `slider={min:3,max:12,width:200,horizontal:true,showAlgebra:true}`；
  构造/重载 XML 也保留 slider 元素。
- 当前自动样本只执行初始 n=3，未逐一执行 3–12 的所有滑块值；预览中可手动移动
  滑块。
- 预览诊断 `output/preview-KxvPQm/` 已返回 ready；窗口关闭后的 closed/cleanup
  由该预览进程写入。

## 前次测试与静态证据快照

- `pnpm check:skill`：6 个 Skill 文件、17 个包内链接；CLI 路径解析并输出版本。
- `pnpm lint`：零错误、零警告。
- `pnpm test`：22 项，21 passed、1 skipped（真实引擎集成默认跳过）。
- `GGB_INTEGRATION=1 node --test dist/tests/integration.test.js`：8 个构建场景
  通过，覆盖完整拖动、静态中点拒绝、修复复验、slider 正多边形、无效命令和
  篡改交互证据；测试从临时 workspace 运行并断言安装包 `output/` 无新增条目。
- 本轮改动把 build/doctor/preview 输出根移到调用方 workspace；该行为由集成测试
  的临时目录和安装包 `output/` 无新增条目检查覆盖。只读文件系统本身尚未单独模拟。

## 历史记录

- 骨架阶段的构建、CLI 边界和 smoke 结果保留在 git 历史中；当时真实引擎、数学
  构造、重载、鼠标联动与宿主安装未验收。
- 无拖动三角形子案例曾交付到 `output/delivery-JdaCeD/delivery`；同标题前次结果
  `output/delivery-azd7fe/delivery` 仍完整且摘要有效。圆迁移结果为
  `output/delivery-O8r53F/delivery`。
- 完整三角形请求早期在 `output/.build-dYxWw0` 保留 unverified 拖动报告并失败；
  该历史结果不代表当前行为。
- 真实 preview 对旧三角形交付完成 headless 复核与可见加载，ready 后 SIGINT，
  返回 closed、退出 0；`output/preview-Ucqg2S` 记录两会话 cleanup.ok=true、
  浏览器断开和服务停止，均无外部请求。

固定实验的独立记录、文件职责和执行顺序见
[technical-experiment.md](technical-experiment.md)；本文件不重复其事实。
