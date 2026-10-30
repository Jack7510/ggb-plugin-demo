# 契约：让模型请求和工具结果可以核对

本页是契约的教学导读，不替代 [demo-contract.md](demo-contract.md)。
结构由 [request.schema.json](../schemas/request.schema.json) 定义，
引用和副作用检查由 [request.ts](../src/request.ts) 补充。

## 一句话职责

契约约定 Agent 提交什么、CLI 检查什么、成功返回什么、失败怎样表达。
请求使用 schemaVersion=2；未知字段或不合规输入不会被静默修正。

## 用三角形串起输入与证据

| 请求内容 | 在案例中讲什么 | 核对位置 |
| --- | --- | --- |
| source、choices | 保留完整原题；A、B、C 的初始坐标是选择 | request.json |
| requirements | 把构造、外观、拖动分别列为必需要求 | verification.json 的 requirements |
| program、outputs | 原生命令生成 M、CM；声明要交付的对象 | 原生对象事实和 GGB |
| checks、styles | 核对 M 的依赖与中点关系、CM 的端点、红色和点名 | initial 与 reloaded 报告 |
| interactions | 声明拖动 A 的样本；不允许省略原题拖动要求 | 每样本前后事实、XML、截图和交互报告 |

完整可运行输入见 [triangle.json](../examples/triangle.json)。录屏时依次定位
`Midpoint(A,B)`、M 的 `parents` 和 `midpointRelation`，再展示 interactions。

## 讲解时指出的关键细节

- **构图程序和验收声明同时存在。** 数学含义交给 GeoGebra；原题到要求清单是否完整，
  仍需独立复核。check 通过只证明预检通过。
- **依赖不能靠坐标冒充。** M 的 parents 应为 A、B；中点关系交给原生布尔探针。
  判定要求原生 boolean 和真值，模型写 passed 或 numeric 的 1 都不能替代它。
- **请求是不可信输入。** 工具拒绝用户脚本、URL、额外赋值及受限副作用命令；
  这不是按题型关键词路由，也不是另造一套数学语言。
- **成功有文件和生命周期要求。** GGB、请求、核验报告、截图、清单及阶段证据必须
  完整。清单逐项关联摘要；删除必需文件并同步清单也必须被拒绝。
  [delivery.ts](../src/delivery.ts) 从保存的事实重算检查，不只读取 passed 文本。
- **机器结果和人类解释分开。** 成功业务 JSON 写 stdout；失败 JSON 写 stderr 并
  非零退出。调用方读取错误码和诊断路径；preview 还需区分 ready 与 closed。

文件摘要用于核对内容一致性，不是来源签名。失败保留隔离诊断，不能作为正式成功交付。
文件列表、容量、容差、退出码和兼容规则统一查[完整契约](demo-contract.md)。

## 留给观众的一句话

> 契约把“请帮我画图”变成可追踪的请求、可执行的检查和可复核的产物。

有限初态、重载与拖动样本只支持本请求的声明结论，不是一般数学证明。
