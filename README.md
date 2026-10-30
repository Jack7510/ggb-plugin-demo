# ggb-plugin-demo

本工程用于录制从空工程开发 Codex/DSH 插件的过程。目标是让宿主 Agent 将文字要求
转成 GeoGebra 原生命令，由本地 CLI 执行、核验并交付可重载 GGB、报告和截图。模型
推理沿用宿主，不新增模型服务或 API Key。

当前已实现独立 v2 CLI 的 doctor、check、build 和 preview；完整三角形案例和带
slider 的圆内接正多边形均已有真实引擎交付证据。可分发 Skill 已编写并通过静态
检查。本机 Codex 已安装并启用，原生 Skill 发现及安装副本 CLI 已验证；实际安装身份与结果见
[验收记录](docs/acceptance.md)，不公开发布。

## 文档与权威来源

| 内容 | 唯一权威 |
| --- | --- |
| 教学目标、范围、非目标、A01–A12 验收条件、失败政策 | [requirements.md](docs/requirements.md) |
| 组件责任、架构、流程、运行状态 | [arch.md](docs/arch.md) |
| CLI、请求字段、检查/报告、交付文件、错误码、preview 协议 | [demo-contract.md](docs/demo-contract.md) |
| 实际运行证据、交付路径、测试结果 | [acceptance.md](docs/acceptance.md) |
| 固定三角形技术实验历史 | [technical-experiment.md](docs/technical-experiment.md) |
| 录屏方案与镜头 | [recording-script.md](docs/recording-script.md) |
| 后续能力迭代计划 | [capability-iteration-script.md](docs/capability-iteration-script.md) |
| Skill 维护者检查步骤 | [skill-development.md](docs/skill-development.md) |
| Skill 安装、CLI 解析与 workspace 输出 | [installation.md](skills/ggb-demo-construction/references/installation.md) |
| Codex 打包、首次 setup、onboarding 与备用入口 | [codex-installation.md](docs/codex-installation.md) |
| Skill 正文与示例 | [SKILL.md](skills/ggb-demo-construction/SKILL.md) |

本 README 只做导航和当前状态摘要，不重复上述文档的规则、字段表或验收路径。

## 总结视频材料

面向同事的 [总结视频提纲与口述稿](docs/summary-video.md) 串起
[Skill](docs/component-skill.md)、[工具](docs/component-tool.md) 和
[契约](docs/component-contract.md) 三份短说明。材料是当前实现的教学摘要，
详细规则与实际证据仍以文档表中的权威来源为准。

需要沿一次请求深入代码时，阅读[三角形案例执行走读](docs/triangle-execution-walkthrough.md)，
按 Codex / Skill、请求、CLI、核验、交付与 preview 顺序对照设计和实现。

## 教学命名

插件为 `ggb-plugin-demo`，Skill 为 `ggb-demo-construction`，本地来源为
`ggb-plugin-demo-local`。可分发 Skill 位于
[skills/ggb-demo-construction/SKILL.md](skills/ggb-demo-construction/SKILL.md)，
引用和示例分别放在该目录的 `references/` 与 `examples/`。DSH npm 包名、账号和
发布目标待确认；`package.json` 的 `private: true` 阻止误发布。

## 目录

```text
ggb-plugin-demo/
├── src/                        # CLI、请求、浏览器、核验、交付与预览
├── schemas/request.schema.json # 请求结构依据
├── examples/                   # 三角形、反例与 slider 正多边形请求
├── skills/ggb-demo-construction/ # Skill、引用、安装与示例
├── skills/setup/               # 本安装副本初始化 Skill
├── viewer/                     # 可信浏览器桥接与固定实验页
├── tests/                      # Node 测试与真实引擎集成
├── scripts/                    # setup-plugin、打包、runtime/smoke 与 Skill 检查
├── docs/                       # 需求、架构、契约、验收、录屏与 Skill 维护
├── package.json                # 单包 ESM 工程，禁止发布
├── plugin.json                 # Codex 插件身份、Skill 与 onboarding 声明
├── pnpm-lock.yaml              # 依赖版本与完整性锁
├── tsconfig.json               # gts 严格 TypeScript 编译
├── eslint.config.js            # Google gts 与加强规则
├── runtime.lock.json           # 固定运行时来源、版本与 SHA-256
├── THIRD_PARTY_NOTICES.md
├── AGENTS.md
└── README.md
```

`dist/` 为编译输出，`node_modules/` 为本工程依赖，`.pnpm-store/` 为包存储。
`.runtime/` 存放独立下载的运行时；CLI 的 `output/` 位于调用方工作目录，不写安装
包。上述目录均忽略，不提交。viewer 从源码目录读取，tsc 不复制静态资源。

## 环境与安装

CLI 和 setup 需要 Node.js 22+、pnpm 11.7.0 和系统 Chrome 或 Edge。
固定 smoke 命令仍显式使用系统 Chrome。
CLI 与 setup 共用 Chrome/Edge 系统检测，不自动下载浏览器或借其他客户端缓存。

```sh
pnpm install --frozen-lockfile --store-dir .pnpm-store
pnpm build
pnpm setup:runtime
pnpm cli doctor
```

2026-10-29 本机版本探测：Node.js 26.5.1、pnpm 11.7.0、Chrome 156.0.8078.48、
Codex CLI 0.165.0、DSH 0.2.1-rc.3。版本探测不表示插件接入或独立安装通过；
Node 22 最低版本未另做实机验证。

运行时准备需要本机 `curl` 和 `unzip`，GGB 审计也使用 `unzip`。
准备脚本只下载锁定的官方运行时及许可快照，不改动全局环境。
运行所需的完整安装布局见[安装契约](skills/ggb-demo-construction/references/installation.md)。

依赖使用精确版本和锁文件，不引用相邻样板工程的产物。独立安装验收必须使用新的
安装根，不能以开发目录运行成功替代。

本地 Codex 打包与安装步骤见 [codex-installation.md](docs/codex-installation.md)。
安装后使用包内 setup Skill 或 setup-plugin.mjs 完成首次准备；
UI 入口未验证时用同一脚本备用，不把脚本成功等同于 UI 验证。
这次只做本地来源安装，不公开发布。

## 当前命令

```sh
pnpm build
pnpm test
pnpm smoke:browser
pnpm cli --help
pnpm cli doctor
pnpm cli check --request examples/triangle.json
pnpm cli build --request examples/triangle.json
pnpm cli build --request examples/triangle-static.json
pnpm demo:counterexample
pnpm demo:drag-video
pnpm check:skill
pnpm pack:codex
# 从用户 workspace 调用已安装副本：
# node <PACKAGE_ROOT>/scripts/setup-plugin.mjs --workspace <WORKSPACE>
```

先构建再调用 CLI。命令行为、请求字段、交付文件、错误码和 preview 生命周期以
[demo-contract.md](docs/demo-contract.md) 为准；实际测试结果见
[acceptance.md](docs/acceptance.md)。`pnpm check:skill` 的静态检查范围见
[skill-development.md](docs/skill-development.md)。

`pnpm test` 默认跳过真实引擎集成；真实集成入口、固定实验和 Skill 验证命令见
各自文档。Chrome 与回环服务需要当前环境允许启动和监听。

## 当前边界

- 只承诺新建二维构造的首轮教学案例；已有 GGB 编辑、三维、复杂 CAS、题目答案或
  完整证明不在范围。
- build 只有在全部声明条件、独立重载、每个拖动样本和资源关闭通过后才提交正式
  delivery；失败保留诊断，不放宽容差。
- 当前取消协议、运行时逐文件审计、双宿主自然语言首题和公开发布仍未完成或验收。
  本机 Codex 安装验证与完整双宿主验收分别记录。
- 有限初态、重载和交互样本不是一般数学证明；滑块 3–12 的全部取值未逐一自动
  采样。
- 完整要求见 [requirements.md](docs/requirements.md)；能力边界和错误语义见
  [demo-contract.md](docs/demo-contract.md)。

## 固定实验与 Skill

固定三角形技术实验的入口、历史结果和文件职责见
[technical-experiment.md](docs/technical-experiment.md)。它是历史技术记录，不是
正式交付接口。

Skill 的通用工作流、引用、安装契约和示例见
[SKILL.md](skills/ggb-demo-construction/SKILL.md) 和
[installation.md](skills/ggb-demo-construction/references/installation.md)；
维护者静态检查与显式读取验证见
[skill-development.md](docs/skill-development.md)。本阶段已授权本机 Codex 打包安装；DSH 与公开发布不在范围。

## 编码规范与注释

本工程的 TypeScript 和 JavaScript 严格遵循
[Google 编码规范](https://google.github.io/styleguide/tsguide.html)，使用固定
gts 7.0.0 执行机械检查和格式化。编译器固定为 TypeScript 6.0.3；保留严格类型检查、
ESM 和浏览器 DOM 类型。

```sh
pnpm lint
pnpm fix
pnpm build
```

lint 覆盖 src、tests、scripts 和 viewer 的自有代码，要求零错误、零告警；fix
自动整理格式和可修复问题。代码模块提供职责概述，公开 API 使用 JSDoc；注释说明
原生事实来源、输入边界、资源归属、独立重载、交付门禁和预览退出的原因。Google
规范中工具无法自动判定的命名、可读性和注释要求仍须在 Review 中检查。具体要求见
[AGENTS.md](AGENTS.md)。
