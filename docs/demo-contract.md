# 独立 CLI 与请求契约 v2

本文件是 CLI 参数、请求 schema、检查/报告、交付文件和 preview 协议的规范。
需求与验收条件见 [requirements.md](requirements.md)，架构/流程/状态见
[arch.md](arch.md)，实际运行证据见 [acceptance.md](acceptance.md)。

## 本版范围与接口调整

首次初始化使用包内 setup Skill 和 setup-plugin.mjs，输入输出及失败规则统一见
[codex-installation.md](codex-installation.md)。CLI 和初始化共用系统 Chrome/Edge 检测。

入口为 `node dist/src/cli.js`。doctor、check、build 和 preview 均已实现，包含真实鼠标拖动门禁，不依赖宿主接入，不新增模型服务或 API Key，不发布。

命令参数保持不变。请求与 JSON 响应升级到 schemaVersion=2，因为请求新增必填 outputs、interactions，build 从最小结果升级为正式 delivery，preview 需要识别完整交付。v1 请求和旧 minimal-build 目录不静默升级，必须显式补齐字段并重新构建。本段又在 verification.json 增加 requirements 和交互证据文件；上一段没有这些字段的 v2 交付同样不会被静默升级或补写，preview 会拒绝，需按当前契约重新构建。旧目录仍保留。当前完整性检查补齐阶段事实、XML、截图、请求日志和许可文件；旧 v2 目录缺少这些证据时明确拒绝，不能补造历史证据。

正式交付只表示本请求声明的全部必需条件通过，不自动表示自然语言提取完整性或一般数学证明通过。真实鼠标拖动门禁已实现：build 为每个交互样本关闭原上下文、在空 applet 中重新读取同一磁盘 GGB，再用真实鼠标拖动声明的可移动点，记录前后事实、命中候选、目标位移和截图。目标命中歧义、点未实际移动、关系失败、独立加载不一致或证据不足时返回 VERIFICATION_FAILED，禁止交付。不能删除完整案例的拖动要求后宣称原题完成。

[triangle.json](../examples/triangle.json) 保留完整原题及真实鼠标拖动样本，全部声明条件、独立重载和拖动样本通过后正式交付。[triangle-static.json](../examples/triangle-static.json) 是明确不含拖动要求的技术子案例，保留为迁移回归，不冒充完整案例。[triangle-counterexample.json](../examples/triangle-counterexample.json) 是测试专用静态中点反例，预期在初始依赖检查失败。

## 命令与输出

先执行 `pnpm build`。以下命令可独立运行：

```sh
node dist/src/cli.js doctor
node dist/src/cli.js check --request examples/triangle.json
node dist/src/cli.js build --request examples/triangle.json
node dist/src/cli.js build --request examples/triangle-static.json
node dist/src/cli.js preview --delivery <build返回的delivery路径>
```

最后一行的路径须替换为实际值。

| 入口 | 行为 | 成功边界 |
| --- | --- | --- |
| doctor | 核对自身固定压缩包 SHA-256、receipt 和许可；真实加载 applet 并构造 DoctorPoint=(1,2)，检查类型和坐标；关闭全部资源 | result.scope=runtime-readiness；返回证据 artifactDirectory，不证明题目成立 |
| check --request | 读取最多 1 MiB UTF-8 JSON，检查结构、引用、容量、条件覆盖和副作用规则 | scope=input-validation-only，mathematicalValidity=not-evaluated；不启动浏览器、不输出交付；报告 interactionCount 与 unsupportedCapabilities |
| build --request | 检查能力、真实执行、逐要求核验、导出原生 GGB、新空 applet 磁盘重载、复核、每个交互样本独立加载与真实鼠标拖动、关闭资源、最后提交交付 | result.scope=declared-request，delivery 为实际绝对路径；不返回旧 artifactDirectory 别名 |
| preview --delivery | 校验完整交付、文件摘要和记录，再 headless 加载同一 GGB 复核，关闭验证资源，最后在专用可见窗口加载相同文件字节 | 发送 ready 事件，保持运行；关闭窗口或 Ctrl+C 后释放资源并发送 closed，退出 0 |

无参数/--help 输出文本帮助，--version 输出工程版本，退出 0。未知、缺失、重复、多余参数及空路径均拒绝；以 -- 开头的路径值也拒绝。请求/交付路径相对调用工作目录解析；schema、viewer 和运行时按安装根定位；output 根按调用方工作目录定位，不写安装包，也不回退到其他客户端缓存。

成功业务响应在 stdout 输出一行 JSON：

```json
{"schemaVersion":2,"ok":true,"command":"check","result":{"scope":"input-validation-only","requirementCount":3,"checkCount":8,"mathematicalValidity":"not-evaluated","interactionCount":1,"unsupportedCapabilities":[]}}
```

失败只在 stderr 输出 JSON，非零退出，不输出成功 delivery：

```json
{"schemaVersion":2,"ok":false,"command":"build","error":{"code":"VERIFICATION_FAILED","message":"Mouse interaction samples failed","diagnostics":"/absolute/output/.build-example"}}
```

错误码供机器判别，message 供解释，不按文案分支。参数、文件或结构预检失败可没有诊断目录；执行或能力失败保留 diagnostics。修复输入须开启新运行，旧失败证据不改写。

## 请求 schema 与引用

[request.schema.json](../schemas/request.schema.json) 是唯一运行时结构依据，使用 draft-07 和锁定 Ajv；不强制转换类型、不填默认值、不删除未知字段。语义引用和副作用策略由 src/request.ts 补充。

| 字段 | 约束 | 责任 |
| --- | --- | --- |
| schemaVersion | 必需，固定 2 | 拒绝 v1 和未知版本 |
| title | 必需，1–120 字符且非空白 | 标题仅作为数据，不用作路径或题型路由 |
| source | 必需，1–4000 字符且非空白 | 保存原题；工具不自动证明提取完整 |
| choices | 必需，0–30 个非空字符串，每项最多 4000 字符 | 保存初始构型和坐标的选择，不暗加数学条件 |
| requirements | 必需，1–50 项 `{id,description}`，id 唯一 | 声明全部必需要求 |
| program | 必需，1–100 项 `{label,expression}` | 按顺序把 label=expression 提交给原生引擎 |
| outputs | 必需，1–100 个唯一标签 | 声明交付对象，均须有显式 program 标签和 object 检查 |
| styles | 必需，0–100 项 | label、requirement 必填，color / labelVisible 至少指定一个 |
| checks | 必需，1–100 项 | 唯一 id，关联已声明 requirement；object 或 boolean |
| interactions | 必需，0–20 项 | 无适用交互时显式 []；有拖动要求时不能填 [] 来隐藏要求 |
| view | 必需，4 个数值 | `[xmin,xmax,ymin,ymax]`，各轴下界小于上界，仅用于视图 |

交付文件名允许 ASCII 字母开头，后接字母、数字、下划线、连字符或点，最多 101 字符。交互 id 原样用于文件名，例如 `move_A` 不会被重命名。当前交付生成 26 个基础文件，每个交互样本增加 9 个文件；20 个样本共 206 项，处于清单上限内。

对象层级均拒绝未知字段和不允许的 null。标签和 id 为 ASCII 字母开头，后接字母、数字、下划线，最多 40 字符。标签唯一，ggbCheck 前缀保留。expression 最多 1000 字符。

每个 program 主标签必须有 object 检查；每个 requirement 至少关联检查、样式或交互项。未知引用、前向引用、重复 id、重复样式目标、声明输出缺失或漏检条件均拒绝。结构覆盖只针对声明清单，原题到清单仍须独立复核，不用题目关键词推测是否完整。

交互样本形状：

```json
{"id":"moveA","requirement":"dragA","kind":"drag","label":"A","from":[0,0],"to":[-1,1],"checks":["midpointRelation","median"]}
```

id 唯一；requirement、label、checks 必须引用已声明内容；from/to 是有限二维坐标且必须不同。样本声明 A 的起始与目标世界坐标，引擎在真实画布上按当前视口换算为像素；工具先用真实鼠标按下、连续移动、松开，再读取原生事实。不能使用 SetCoords、数值赋值或其他 API 改坐标代替鼠标证据。鼠标证据使用固定容差：样本起点与拖动前 A 的位置按 1e-9 匹配，目标误差每轴不超过 2 屏幕像素，最小实际位移 2 像素；这些是鼠标像素容差，不放宽对象坐标检查的 1e-9 容差。

## 原生命令与副作用边界

允许数值、先前声明标签、原生函数/命令，以及算术、比较、括号、方括号和集合括号。数学语法、重载和标签大小写由 GeoGebra 解释，例如小写坐标标签可能成为向量，工具不自行改名。裸标识符只接受已声明标签及 pi、e、true、false。自动生成但未显式声明的多输出标签不能作为后续引用；执行时不得覆盖已存在标签。

不接受字符串、反斜杠、分号、换行、注释、额外赋值、用户 JavaScript、外部材料或 URL。工具生成唯一的赋值等号；比较可用 == 或原生 AreEqual。副作用策略拒绝 Set*、Execute、Run*Script、JavaScript、ReadText、Open*、Export*、Delete、Rename、Start*、PlaySound、UpdateConstruction、Zoom*、Pan、SelectObjects、Show*、Hide*、Button、InputBox、Checkbox、Turtle*、Random*、Shuffle、Sample 等标识符。这是执行限制，不是数学命令白名单或题型路由。

事实核验当前支持 point、line、segment、triangle、polygon、circle、conic、vector、numeric、boolean。引擎产生其他类型时也必须失败，不宣称覆盖三维、CAS、文本或所有二维对象。

## 检查与通过条件

object 检查含 id、requirement、kind=object、label，可选 type、parents、coordinates。对象必须存在且已定义；type 比较原生 API 类型；parents 按顺序比较原生算法输入及独立性，空数组要求独立对象；coordinates 只用于二维点，绝对容差固定 1e-9，不允许模型放宽。

boolean 检查含 id、requirement、kind=boolean、expression。工具创建原生 ggbCheck<索引> 探针，要求类型 boolean、已定义且值为 1；numeric 的 1 不能冒充通过。探针随 GGB 导出，重载后检查原探针，不重建替代。

样式 color 为大写 #RRGGBB，labelVisible 为布尔值并采用名称模式。样式目标和关联 requirement 必须已声明。所有实际对象还须存在、已定义且属于支持类型。

报告按初态 initial、重载 reloaded 和每个交互样本分别记录检查、样式、期望、实际原生事实和 passed/failed。交互报告包含：样本声明的 from/to、真实指针像素、命中候选、拖动前后 A 与 M 的事实、实际位移、目标像素误差、样本选中检查、全部去坐标不变量检查及样式。顶层 requirements 将证据映射回每条原题要求。slider 对象的实际 fact 同时记录 min、max、width、horizontal 和 showAlgebra；这只证明控件设置，不证明所有滑块取值都已执行。任一失败、未验证、脚本审计不一致、重载内容差异、独立加载不一致、目标歧义、未移动或资源关闭失败都阻止正式交付。有限样本不是一般数学证明。

## 构图与交付文件

每次在调用方工作目录的 output/.build-* 写独立暂存区，先保存 request.json。能力通过后核对运行时，启动专用 headless Chrome/Edge，只允许本次同源 GET，阻止 WebSocket、service worker 和下载。服务只提供固定 viewer 和 realpath 限定的运行时文件。

构造/重载完成后 viewer 切换为仅绘图区，交付截图不显示内部 ggbCheck 探针；完整探针事实仍保存在 JSON/XML。构造后保存真实事实、XML、截图和核验报告。getBase64 导出原生 GGB 到磁盘；检查 ZIP 完整性，只接受当前 CLI 生成的基础 GGB 条目，拒绝宏、图片资源、非空 JavaScript 及 GGBScript。关闭原页面与上下文，新 applet 对象数必须为 0，再读取磁盘字节加载，重新核验并比较对象内容、依赖、样式和脚本。每个拖动样本重复空 applet 检查和磁盘字节加载，不复用前一交互的内存状态。

资源关闭后写清单，再用同一完整交付验证器核对文件和报告。成功时先以 mkdtemp 在调用方 output/ 取得独占父目录 delivery-*，再将暂存目录重命名为其中尚不存在的 delivery 子目录。不同运行不共用目标，不按标题命名，不覆盖已有结果。重命名失败非零退出，暂存证据保留，不返回成功路径。

正式目录至少包括：

| 文件 | 内容 |
| --- | --- |
| construction.ggb | 原生引擎导出的可重载文件 |
| request.json | 本次完整 v2 请求 |
| verification.json | scope=declared-request、status=passed、initial/reloaded 两阶段报告、requirements 汇总、contentEqual=true；交互请求标 mouseInteraction=verified 并附每样本报告 |
| interaction-<id>-empty / before / after 的 JSON、XML、PNG | 每个样本的空 applet、真实鼠标拖动前后事实、XML 与截图 |
| preview.png | 同一重载阶段的真实截图副本 |
| manifest.json | schemaVersion=2、kind=delivery、ggbFile、outputs、requestSha256、工具版本、运行时身份、其他文件 SHA-256 |
| engine-ready / constructed / exported / reload-empty / reloaded 的 JSON、XML、PNG | 各阶段实际证据 |
| runtime.json、environment.json、cleanup.json、requests.json、browser-log.json | 身份、浏览器、本地请求与资源退出证据 |
| runtime-README.txt、geogebra-license.html | 包内说明及官方许可快照 |

以上文件均为必需文件；从目录和清单同时删除任何一项也必须拒绝。所有必需 PNG 均检查文件签名。

manifest 不包含自身摘要。失败目录只含诊断/暂存，不产生 kind=delivery 的成功响应。即使失败目录有 GGB，也不能称为正式交付。doctor 单独记录 doctor-evidence，不冒充 delivery。

## preview 的完整性与生命周期

preview 拒绝旧 v1 最小结果、doctor 证据及不完整目录。读取清单后检查：安全文件名、必需文件、目录内容完全对应、叶文件为非软链接普通文件、每项 SHA-256、请求摘要、声明输出、cleanup 的真实布尔字段、报告与原始事实重算一致、每个交互样本的独立加载/命中/位移/关系/截图证据、requirements 汇总，以及 GGB 条目和脚本边界。最多 256 个清单文件（不含 manifest 自身），每个不超过 16 MiB；ZIP 检查每项输出最多 4 MiB、单次命令超时 5 秒。不支持任意外部 GGB 或宏。

之后用本地锁定引擎 headless 重载已读取并核对摘要的 GGB 字节，重新核验，与交付 reloaded.json 比较；关闭验证资源后，另启专用可见窗口加载完全相同的字节。两个阶段均不调用 program 重建，交付目录只读。

验证完成后 stdout 发送 `result.event=ready`，含 delivery、GGB 摘要、预览诊断目录及退出说明。ready 仅表示预览就绪，不表示资源已退出。关闭专用窗口或按 Ctrl+C（也处理 SIGTERM/SIGHUP）后，关闭页面、上下文、浏览器和服务，再发送 `event=closed` 并退出 0。预览自己拥有信号处理，禁用 Playwright 默认信号退出，确保 finally 执行。就绪前取消或任何校验失败均非零退出；失败可发生在 ready 之后，调用方仍须观察最终退出码。

预览诊断独立写调用方 output/preview-*，保存 headless 复核事实、截图、会话请求/日志与清理结果。不会修改原 request、GGB、报告或截图。用户在预览窗口内拖动仅改变内存，不自动保存到交付文件，也不替代 build 已保存的自动鼠标拖动样本证据。

## 超时、错误与限制

浏览器启动 30 秒、applet 就绪 60 秒、导出/加载回调 30 秒，Node 桥接操作额外 35 秒超时。正常错误与超时进入 finally。build 的完整信号取消协议仍待下一段；本批明确验证 preview 的信号退出。运行时当前核对官方压缩包、receipt 和实际版本，不宣称逐文件审计了解压目录。清单摘要用于内容一致性，不是发布签名。

| 退出码 | 错误码 | 含义 |
| --- | --- | --- |
| 0 | 无 | 帮助、版本、check 结构通过、真实 doctor、请求范围内 build 成功，或预览正常关闭 |
| 2 | INVALID_ARGUMENT | CLI 参数错误 |
| 1 | INPUT_INVALID | 文件、JSON、schema、引用、容量、覆盖或副作用错误 |
| 1 | UNSUPPORTED_CAPABILITY | 出现未实现的交互类型，必需条件未验证，禁止交付 |
| 1 | RUNTIME_UNAVAILABLE | 运行时、摘要、receipt、版本或 applet 就绪错误 |
| 1 | ENGINE_ERROR | 原生命令或执行/导出错误 |
| 1 | VERIFICATION_FAILED | 对象、条件、重载、内容或 GGB 审计失败 |
| 1 | CLEANUP_FAILED | 资源无法关闭，禁止成功提交 |
| 1 | DELIVERY_ERROR | 文件写入、清单验证或重命名失败 |
| 1 | PREVIEW_ERROR | 完整性、摘要、记录或预览复核失败 |
| 1 | TIMEOUT / CANCELLED | 桥接超时或就绪前取消 |
| 1 | INTERNAL_ERROR | 其他未分类错误，仍不能输出成功 |

## 复现检查

```sh
pnpm build
GGB_INTEGRATION=1 node --test dist/tests/*.test.js
```

真实集成覆盖下划线交互 id、20 个独立加载的拖动样本、删除必需证据并同步清单后的拒绝、完整拖动成功、不含拖动的三角形子案例、圆的迁移案例、静态中点拒绝、修复为真实中点后的复验、slider 正多边形、无效命令、篡改交付拒绝，以及真实预览 ready → SIGINT → closed 的资源退出；测试从临时 workspace 运行并检查安装包 output/ 无新增。默认 pnpm test 跳过真实引擎集成；回环服务测试仍需要当前环境允许监听端口。

测试专用入口：

```sh
pnpm demo:counterexample
pnpm demo:drag-video
```

demo:counterexample 先跑完整正例，再跑静态中点反例，最后修复为 Midpoint(A,B) 复验。退出 0 只表示预期拒绝被正确观测；输出必须显示底层 midpoint 检查失败及 M independent=true、parents=[]，不能解释为错误构图成功。demo:drag-video 是 headless 连续拖动录像诊断，目录含 NOT_A_DELIVERY.json，不导出 GGB、不提交 delivery，也不改变正式路径。

## 实际验收证据

实际运行结果、路径、日期和限制不在本契约中重复维护。完整案例、反例、拖动、
slider 正多边形、预览和测试证据见 [acceptance.md](acceptance.md)。固定三角形
技术实验的历史快照见 [technical-experiment.md](technical-experiment.md)。

本契约只定义当前规范；旧运行的路径不是当前契约的一部分。
