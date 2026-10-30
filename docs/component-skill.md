# Skill：告诉 Agent 怎样使用工具

本页供同事讲解与录屏使用，是当前实现的教学摘要，不新增规则。
工作流以 [SKILL.md](../skills/ggb-demo-construction/SKILL.md) 为准；
完整责任边界见 [arch.md](arch.md)。

## 一句话职责

`ggb-demo-construction` 是给宿主 Agent 阅读的操作说明。Agent 使用宿主推理，
按说明提取条件、编写请求、调用 CLI、阅读证据并交付结果。

## 讲解时指出的关键细节

- **入口与内容分开。** SKILL.md 的 frontmatter 描述名称和适用场景，正文说明
  工作流。写好这些内容不表示宿主已经发现或安装了 Skill。
- **正文、引用、示例分层。** 正文讲通用步骤；references 提供请求、安装与报告
  阅读说明；examples 放三角形和圆内接正多边形示例。正文不内置单题构图配方。
- **模型负责理解，工具负责判定。** Agent 保存原题，把初始坐标等演示选择单列。
  每条必需条件进入声明清单，Agent 不能用自己的文字覆盖失败结果。
- **按实际安装定位。** 通过 Skill 路径或明确的 GGB_CLI 定位匹配 CLI；资源从
  CLI 所属安装根读取，输出写用户 workspace。缺资源时报告，不搜索其他客户端缓存。
- **失败修复有边界。** Skill 要求保留失败证据，最多自动修复两次；不得删条件、
  放宽容差，或用静态子案例冒充完整题目。

安装与定位步骤统一见 [installation.md](../skills/ggb-demo-construction/references/installation.md)，
此处不另写一套 shell 定位程序。

## 屏幕上展示什么

1. 打开 [SKILL.md](../skills/ggb-demo-construction/SKILL.md)，展示 frontmatter 和工作流标题。
2. 打开 [报告阅读说明](../skills/ggb-demo-construction/references/report-reading.md)，
   展示 initial、reloaded、requirements、interactions 和 cleanup 的阅读顺序。
3. 打开 [三角形请求](../examples/triangle.json)，指出原题保留在 source，坐标选择保留在 choices。

## 留给观众的一句话

> Skill 把使用流程交给 Agent；真实执行和通过条件仍由本地工具控制。

当前只完成 Skill 编写和静态验证，宿主自动发现与安装未验收。
维护者检查入口见 [skill-development.md](skill-development.md)。
