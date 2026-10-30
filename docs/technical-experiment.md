# 固定三角形技术实验记录

> Historical snapshot (2026-10-29). Current requirements and contract are
> [requirements.md](requirements.md) and [demo-contract.md](demo-contract.md);
> current run evidence is in [acceptance.md](acceptance.md). This file preserves
> the fixed experiment record and its file responsibilities only.

## 范围与入口

日期：2026-10-29。本记录仅证明固定案例的真实引擎构造、GGB 导出及新 applet 磁盘重载，不是正式交付。当时未写 Skill、未接宿主、未发布，四个业务命令仍返回未实现。

复现入口：`pnpm setup:runtime`，然后 `pnpm experiment:triangle`。本次实际执行 `node scripts/setup-runtime.mjs`、`pnpm build`、`node dist/src/experiment.js`。浏览器和回环服务需要当前环境允许启动进程与监听本地端口；本次在执行权限允许后运行。

初始坐标 A=(0,0)、B=(6,0)、C=(2,4) 是演示选择。固定原生命令创建 tri=Polygon(A,B,C)、M=Midpoint(A,B)、CM=Segment(C,M)，将 M 和 CM 标红并显示点名；原生布尔探针 midpointOK=AreEqual(M,Midpoint(A,B)) 记录引擎判断，不手写核验通过。

## 来源与运行时身份

- 官方包：https://download.geogebra.org/installers/5.4/geogebra-math-apps-bundle-5-4-932-1.zip
- 固定版本及实际引擎版本：5.4.932.1。
- 本工程独立下载后计算的 SHA-256：`c139f3edb51c004ec67d83226a1f1215486f8559ad98ee37e9e775aac278e96e`。
- 保留完整解压包、包内 README.txt 和[官方许可页](https://www.geogebra.org/license) HTML 快照，实验目录也保存说明与许可副本。
- 浏览器：系统 Chrome 156.0.8078.48，Playwright 1.64.1；专用 headless 实例，无其他客户端缓存。

## 首次失败与修复

首次目录为 `output/technical-triangle-GH0vud/`。首个错误是固定实验将 Polygon(A,B,C) 的 API 类型预设为 polygon，而真实 getObjectType 返回 triangle。原生 XML 的 element 类型仍是 polygon，两类接口的表述不能混用。修复为精确断言 API 类型 triangle，保留坐标、依赖、颜色、点名和中点判定检查，不改变数学条件或容差。失败目录保留事实、截图、错误及资源关闭记录，没有导出成功结果。

## 成功运行

成功目录为 `output/technical-triangle-hKtRsU/`，仅作为技术实验输出：

| 阶段 | 实际证据 |
| --- | --- |
| engine-ready | 真实 applet 就绪，版本 5.4.932.1；保存 JSON、XML、PNG |
| constructed | 关键对象存在且已定义，M=(3,0)，midpointOK=1；保存事实与截图 |
| exported | getBase64 回调产生原生 GGB，写入磁盘并通过 unzip 完整性检查；保存事实与截图 |
| reload-empty | 关闭原页面与上下文，新上下文中的独立 applet 对象数为 0；保存事实与截图 |
| reloaded | 重新读取磁盘 GGB 字节后加载；全部固定断言再次通过，保存事实与截图 |

GGB：`output/technical-triangle-hKtRsU/triangle.ggb`，4710 字节；SHA-256 为 `98c2128b90a835259b891c052ca459fc5faf110c2a27c5d41832291a4dd729c8`。

重载后实际类型：A/B/C/M 为 point，tri 为 triangle，CM 为 segment。原生算法证据显示 M 的输入为 A、B，CM 的输入为 C、M，tri 的输入为 A、B、C。M 和 CM 颜色均为 #FF0000，A/B/C/M 点名可见。事实记录还保留 Polygon 自动生成的边及原生依赖 XML。

requests.json 记录 34 个本地请求，均为 HTTP 200，没有外部请求；路由仅允许同源 GET，服务仅提供固定 viewer 和 realpath 限定的运行时文件。其他路径、非 GET、目录穿越及软链接逃逸由针对性测试验证拒绝。

cleanup.json 确认页面、上下文、浏览器与本地服务关闭，browserDisconnected=true、serverStopped=true，实验进程退出 0。result.json 的 ok 来自实际断言和清理状态，不是模型声明。截图已人工视觉核对，三角形、M、红色 CM 与点名可见。

## 文件职责

| 文件 | 作用 |
| --- | --- |
| [src/experiment.ts](../src/experiment.ts) | 实验总控。在 Node.js 中启动服务和浏览器，组织构造、事实采集、截图、GGB 保存和独立重载，记录诊断，并在 finally 中关闭资源。 |
| [src/experiment_support.ts](../src/experiment_support.ts) | 保留固定案例的独立断言，并从 server.ts 兼容导出共享服务；通用请求判定位于 verify.ts。 |
| [viewer/experiment.html](../viewer/experiment.html) | 浏览器中的实验页面，加载本地 GeoGebra 运行时并提供 applet 容器。 |
| [viewer/experiment.js](../viewer/experiment.js) | 保留固定原生命令及中点探针；事实采集、原生导出和加载已提取到 engine.js，与通用 CLI 共享。 |
| [tests/experiment_server.test.ts](../tests/experiment_server.test.ts) | 检查本地服务访问边界，验证任意文件读取、目录穿越、软链接逃逸和非 GET 请求被拒绝。 |

experiment.ts 与 experiment.js 分属 Node.js 和浏览器两个运行环境：前者负责执行
流程及磁盘文件，后者保留固定案例。通用 EngineSession、server、runtime 和
viewer/engine.js 现在同时供业务链路与实验使用。

## 执行顺序

```text
pnpm experiment:triangle
  → 编译 TypeScript
  → experiment.ts 启动本地服务和专用 headless Chrome
  → 浏览器打开 experiment.html，加载 experiment.js 与本地 GeoGebra
  → 执行固定三角形构造，保存事实、截图和原生 GGB
  → 关闭原页面与上下文，创建新的空 applet
  → 重新读取磁盘 GGB，加载后再次检查
  → finally 关闭页面、上下文、浏览器和服务
```

这些固定实验用于验证真实引擎执行、导出和重载。通用 CLI 已提取共享本地服务、
引擎调用和资源管理逻辑；固定三角形命令保留为独立实验和回归案例，不能成为按
题型关键词路由的生产实现。真实鼠标联动在通用 build 中另做，不由固定实验冒充。

## 限制与后续

当时鼠标拖动未测试；有限初态和重载证据不是动态联动验收或一般数学证明。当时未实现请求 schema、通用执行入口、通用核验、正式交付、取消信号的完整验收或双宿主安装。运行时 SHA-256 核对针对官方压缩包，不是运行前对所有解压文件的逐文件完整性审计。后续可在真实 doctor 阶段补充该项。

本记录保留为该固定实验的历史结果。后续通用 CLI 已加入每个交互样本独立加载、真实鼠标拖动和 requirements 汇总门禁；那不是本实验文件的作用，详见 [CLI 契约](demo-contract.md)。
