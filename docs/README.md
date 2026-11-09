# SrP-IMG 文档

四套规范，按"改的是哪一层"划分。正文统一使用中文；代码、路径、命令、JSON 字段保持原样。

| 分册 | 回答什么问题 | 谁该读 |
|---|---|---|
| [architecture/](architecture/README.md) | 为什么分四层？生成物归谁写？三种入口如何共存？哪些顺序是契约？ | 改结构、动 Pipeline 或 Worker、做 code review 的人 |
| [design/](design/README.md) | 颜色/字体/间距用哪些 token？组件、动效、双语与可达性怎么约束？ | 写 `src/`、调 UI、做视觉验收的人 |
| [development/](development/README.md) | 本地怎么跑？测试有哪几套？提交、CI 与发布怎么走？ | 每天写代码、跑 CI 的人 |
| [reference/](reference/README.md) | API 契约是什么？有哪些环境变量、生成物与配置项？规则层怎么配？ | 接 API 的人、排查线上响应的人 |

## 建议阅读顺序

- **新加入项目**：本页 → [development/README.md](development/README.md) → [architecture/README.md](architecture/README.md) → 再按要改的层翻对应分册。
- **只改界面**：[design/README.md](design/README.md) → [design/components.md](design/components.md) → [design/i18n-accessibility.md](design/i18n-accessibility.md)。
- **只动接口或运行时**：[architecture/runtime.md](architecture/runtime.md) → [reference/api.md](reference/api.md) → [reference/configuration.md](reference/configuration.md)。
- **排查"图片类型不对"**：[reference/generated-files.md](reference/generated-files.md)（`slot_formats.js`）→ [architecture/runtime.md](architecture/runtime.md)。
- **配置边缘重写（规则层）**：[reference/transform-rules.md](reference/transform-rules.md)。
- **要改目录或产物归属**：[architecture/layers.md](architecture/layers.md) → [architecture/decisions.md](architecture/decisions.md)。

## 约定

- 文档里出现的每个路径、命令、字段都必须能在仓库里找到出处；改代码时在同一提交内更新对应文档。
- 交叉引用一律用相对路径（`../architecture/layers.md`），不要写死域名或分支名。
- 单篇控制在 60–180 行：超出就拆分文件，不要堆成一个巨型页面。
- 记录"为什么"而不只是"是什么"：取舍与被否掉的方案写进 [architecture/decisions.md](architecture/decisions.md)，实现细节留在代码注释里。
- 结论优先于过程；表格优先于长段落；不使用 emoji 与营销语气。
- 截图统一放在 [screenshots/](screenshots/)，由根目录 README 引用；每张图的来源与再生成方式见 [design/screenshots.md](design/screenshots.md)。

## 分册目录

### architecture

- [README.md](architecture/README.md) — 分册导读与四层总图
- [layers.md](architecture/layers.md) — 四层边界、所有权矩阵、依赖方向、允许与禁止
- [build-pipeline.md](architecture/build-pipeline.md) — 构建期：扫描 → 槽位 → 清单 → 数据模块，以及哪些顺序是契约
- [runtime.md](architecture/runtime.md) — Worker 内部：三种入口、策略引擎、资产保护、`Content-Type` 纠正
- [data-flows.md](architecture/data-flows.md) — 五条主链路：随机跳转、直链、边缘重写、画廊加载、构建与部署
- [decisions.md](architecture/decisions.md) — 已做的取舍、被否掉的方案、遗留问题

### design

- [README.md](design/README.md) — 设计分册导读与设计目标
- [tokens.md](design/tokens.md) — CSS 变量、字体、字号层级、间距、圆角、明暗主题
- [components.md](design/components.md) — Navbar / Footer / 画廊 / API 面板 / 实时预览等复用组件
- [motion.md](design/motion.md) — 路由过渡、顶栏胶囊收敛与回缩、减少动效降级
- [i18n-accessibility.md](design/i18n-accessibility.md) — 中英双语、标题与文案规则、键盘与可达性
- [screenshots.md](design/screenshots.md) — 四张截图的内容与再生成方式

### development

- [README.md](development/README.md) — 开发分册导读与环境清单
- [build.md](development/build.md) — 命令、构建顺序、`dist/` 装配、Windows 注意点
- [code-style.md](development/code-style.md) — TypeScript / React / Python / Worker JS 书写约定
- [testing.md](development/testing.md) — 四套测试、基线门禁、差分矩阵、如何新增测试
- [workflow.md](development/workflow.md) — 分支与提交信息、PR 检查清单、CI 与发布

### reference

- [README.md](reference/README.md) — 参考分册导读
- [api.md](reference/api.md) — `/pic`、`/api/pic`、直链、UA 分流、状态码与响应头
- [configuration.md](reference/configuration.md) — 环境变量全表、`wrangler.jsonc`、`catalog.json`、CLI 参数
- [generated-files.md](reference/generated-files.md) — `counts.json` 字段、`targets.js`、`slot_formats.js`、`dist/` 结构
- [transform-rules.md](reference/transform-rules.md) — 边缘重写（Transform Rules）配置与坑位
