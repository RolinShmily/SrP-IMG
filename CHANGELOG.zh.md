# 更新日志

<p align="center">
  <a href="./CHANGELOG.md">English</a> • <b>简体中文</b>
</p>

本文件记录本项目所有值得注意的变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 变更

* **前端迁移至 Vite + React** —— 将 Next.js 静态导出替换为 Vite 7 多入口构建
  （`index.html`、`gallery.html`、`settings.html`），三个入口挂载同一个 React Router SPA。
  `dist/` 是 Cloudflare Workers 的静态资产目录；字体改为自托管，画廊分类状态由
  `setSearchParams` 驱动，并移除了仅客户端可用的 `useLinkStatus` 加载指示。用户可见行为不变。

### 内部

* **构建管线拆包** —— 将 900 行的 `gen_img.py` 拆成 `pipeline/` 包（`config`、
  `catalog`、`scan`、`image_size`、`pool`、`manifest`、`cli`），分类注册表外置为
  `assets/catalog.json`，生成清单固化到 `contracts/manifest.schema.json`，并新增
  `tests/pipeline/`。所有产物与重构前逐字节一致。

* **Worker 运行时改为手写源码** —— 访问策略引擎与两个入口不再由 Python f-string 生成，
  而是位于 `worker/`（`index.js`、`policy.js`、`pages.js`）。`python -m pipeline` 只生成
  数据模块 `worker/targets.js`；删除 `gen_img.py`、`.nojekyll`、根目录 `index.js` 与
  `pipeline/worker_codegen.py`，`functions/pic.js` 改为 Pages 适配器的再导出。HTTP 行为
  由针对旧生成物的差分级矩阵锁定。

* **目录归位：生成物移出源码树** —— `oriImg/` 迁至 `assets/original/`，手写静态资源
  （`_headers`、`icon.svg`、`placeholder.svg`、`fonts/`）迁至 `assets/static/`（作为 Vite 的
  `publicDir`），生成图片池（`<分类>/<hex>.<后缀>` 与 `counts.json`）迁至
  `assets/generated/`（除清单外仍被 git 忽略）。Vite 构建时把图片池装配进 `dist/`
  （即新的 `assets.directory`），开发期则由一个中间件以同样的扁平 URL
  （`/counts.json`、`/h/00.jpg`）从 `assets/generated/` 直接响应，运行时路径不会出现
  `generated/` 段。`npm test` 串联四套测试，CI 以此作为门禁。

* **后缀/字节格式校验** —— 新增 `pipeline/formats.py`，只读文件头识别
  JPEG/PNG/GIF/WebP（仅标准库）。每次运行会为"有效源文件真实字节与槽位后缀不符"
  的分类各打印一行（`h`/`v` → `.jpg`、`a` → `.jpeg`），因为 Cloudflare 的
  `Content-Type` 取自后缀而不是字节。`python -m pipeline --strict-formats` 会在
  仅扫描、不写盘的前置检查阶段以退出码 1 中止。未改变任何槽位名、生成字节或 URL，
  也未修改 `assets/catalog.json`。

* **运行时 `Content-Type` 纠正** —— 图片池仍保留由后缀构成的 URL，但响应头不再
  与真实字节矛盾：管线把每个槽位的格式编码写入新的生成物
  `worker/slot_formats.js`，`worker/index.js` 再按该表为分类图片覆写
  `Content-Type`（受保护与未受保护两条分支都覆盖，例如真实字节为 WebP 的
  `/a/01.jpeg` 会以 `image/webp` 返回）。未改变任何槽位名、槽位字节、URL、
  `targets.js` 或 `counts.json`；差分级矩阵只对错配槽位排除这一个响应头，并
  显式断言其新值。CI 同步检查扩展到 `slot_formats.js`，`tests/pipeline/` 还锁死
  真实错配数量（`a` 125、`h` 81、`v` 28、`gif` 0 个槽位），避免修复悄悄失效。

* **边缘重写文档** —— 新增 `docs/transform-rules.md`，说明三种并存的入口（规则层重写、
  Worker API、画廊直链），并替换旧的规则表达式：旧写法用 `starts_with("/a")` 匹配，
  会连 `/assets/…` 一起改写从而打断站点 bundle；且以扩展名作为终止条件，把所有分类
  锁死为单一后缀。现在统一改为精确路径形状（`^/h/?$`），与后缀无关且不会递归。

* **交付细节** —— `assets/static/_headers` 现在为内容哈希的 Vite 产物（`/assets/*`）
  与自托管字体（`/fonts/*`）加上一年缓存，此前这两类每次访问都要回源验证。真实树的错配
  门禁从"精确相等"改为**不增长基线**：新增同格式分类不再需要改测试，而任何增量仍然会
  失败；`worker/targets.js` 改为从 `counts.json` 重新推导校验，不再钉死 sha256。
  两个 README 补上 `npm test`，PR 清单列全三个生成数据文件，`.dev.vars.example`
  改为指向 `worker/`。

* **架构说明** —— 新增 `ARCHITECTURE.md`，记录四层结构、所有权矩阵、三种运行时入口，
  以及构建所依赖的不变量。

* **文档分册** —— `docs/` 现为四套规范（`architecture`、`design`、`development`、
  `reference`）加产品截图，入口是 `docs/README.md`。内容覆盖四层所有权与字节契约、
  重构背后的 ADR、设计 token 与组件/动效规则、四套测试与 PR/CI/发布流程，以及
  API/配置/生成物契约。首页与移动端预览截图按 "Next.js" → "Vite + React" 的文案变更
  重拍；`docs/reference/transform-rules.md` 已改为中文并补充了需要清理缓存的场景。

## [0.2.1] - 2026-10-27

### 变更

* **画廊改为预留几何** —— `counts.json` 为每个生成槽位记录宽高比，图片到达前格子就已定尺寸。
  瀑布流在滚动时不再重排（也就是闪烁的来源），加载期间每个格子显示骨架遮罩。比例取自真实素材
  尺寸，配合 `object-contain` 保持零裁切。
* **README 预览图集** —— 截图改为从线上部署（`img.srprolin.com`）直接抓取、宽度 1200px：
  首页默认展示，画廊、API 参考与移动端放在 `<details>` 折叠块中。四张图合计 236 KB，
  较原先单张 393 KB 的 `preview.webp` 更小。

## [0.2.0] - 2026-10-27

### 新增

* **访问策略改为运行时读取** —— Referer 与 CORS 白名单改由 Worker / Pages 环境变量提供（`REFERER_ALLOWED_HOSTS`、`CORS_ALLOWED_ORIGINS` 及若干开关），生成的 `index.js` / `functions/pic.js` 不含任何域名，仓库也不再公开白名单。列表支持逗号或空白分隔，通配符、大小写与去重统一处理；配置非法时 fail closed 返回 HTTP 500。被拒绝的请求与不存在的图片返回完全相同的响应，配置错误也不回显给调用方，因此无法用响应差异反推规则。新增 `.dev.vars.example` 供本地 `wrangler dev` 使用；README 只保留简短部署说明，不再复述完整规则集。
* **动态收敛浮动胶囊导航栏** —— 参考 `SrP-BloG` 实现，页面下滚超 20px 时桌面端两侧平滑向内收敛 8% 并形成毛玻璃立体胶囊；下滚超 350px 自动向上收起、上滚瞬间回显；移动端集成丝滑展开的抽屉面板。
* **全新品牌 SVG 图标** —— 重新设计高分辨率矢量图标（深森林绿圆角底板 + 薄荷绿双层相框与景深山峦），小尺寸与各级 DPI 下均保持清晰锐利。
* **动态路由平滑进入过渡与加载状态** —— 增加 `app/template.tsx` 路由过渡容器，搭配不破坏文本栅格化的渐显动画；导航栏集成 `useLinkStatus` 实时显示路由加载微标。
* **全站国际化 (i18n) 完整覆盖** —— 补全所有页面、动态分类名、自适应比例文字、动态网页标题与屏幕朗读 `aria-live` 播报的中英文支持。
* **自动化测试套件** —— 新增 `tests/backend-contract.test.mjs`（Worker/Pages 安全与 HTTP 契约测试）、`tests/static-export.test.mjs`（静态导出片段路径规范化测试）与 `tests/test_access_policy.py`（策略校验与生成器测试）。

### 变更

* **零裁切实时原图预览** —— 首页实时体验卡片改用响应式视口容器与 `object-contain`，原图比例完整保留，增加加载旋转、失败重试与连续切换防抖竞态处理。
* **画廊 URL 与浏览器历史深度同步** —— 画廊分类切换改为以 URL 查询参数（`?cat=`）为单一真理源，完整支持浏览器前进、后退（History API）。
* **字体抗锯齿与像素锯齿优化** —— 修复字体变量同名循环引用，补全中文字体栈备选，启用清晰排版属性并清除文本容器的浮点缩放与滤镜抖动。
* **Windows 静态导出预取修复** —— 增加构建后处理脚本（`scripts/normalize-static-export.mjs`），修复 Next 16 在 Windows 平台下导出静态片段文件名的反斜杠路径问题。
* **`/settings` 收敛为 API 参考** —— 导航项改为 `API`，页面只讲怎么调接口：302 卡片与直链路径。Cloudflare Transform Rules 生成器及其说明整块从站点移除，配置方法保留在 README 里供需要的人查阅。

### 修复

* 修复深色模式下初次点击主题切换按钮未立即响应的问题。
* 修复剪贴板权限拒绝或执行失败时缺乏可见反馈的交互缺陷。
* 修复 Fancybox 灯箱中 PageUp / PageDown 翻页方向与实例销毁清理问题。

## [0.1.0] - 2026-09-22

首个版本标签。`main` 分支始终可部署，因此本节同时涵盖打标签之前已上线的全部内容。

### 新增

* **画廊前端** —— Next.js 静态导出，支持分类切换（`h`、`v`、`a`、`gif`）、瀑布流布局、
  明暗主题切换，以及带缩放、旋转、全屏与下载的 Fancybox 灯箱。
* **随机图片 API** —— `/pic?img=h|v|ua` 返回 `302` 跳转到随机图片槽位，`ua` 会依据
  `User-Agent` 选择横竖屏。附带宽松 CORS，未知 `img` 参数返回纯文本使用说明。
* **构建引擎**（`gen_img.py`）—— 将 `oriImg/` 扩散为每个分类 `16^hash_length` 个哈希槽位，
  `h`/`v` 强制 `.jpg`，自定义分类保留原后缀，跳过超过 5MB 的文件，并导出
  `public/counts.json` 与重新生成的 Worker 入口文件。
* **Cloudflare 部署** —— Workers Assets 模式的 `wrangler.jsonc`、Pages Function 版本，
  以及构建并部署 `main` 的 GitHub Actions 工作流。
* **文档** —— 双语文档，并记录了「无感模式」的 Cloudflare Transform Rules 配置方案。
* **社区规范文件** —— `CONTRIBUTING`、`CODE_OF_CONDUCT`（Contributor Covenant 2.1）、
  `SECURITY`、本更新日志、Issue 表单、PR 模板与 CI 工作流。
* **持续集成**（`.github/workflows/ci.yml`）—— 每个 PR 上执行代码检查、生成哈希池、
  校验提交的 Worker 入口与生成器输出一致、构建静态导出并做类型检查。
* **代码检查** —— 基于 `eslint-config-next/core-web-vitals` 与 `eslint-config-next/typescript`
  的 ESLint flat config（`eslint.config.mjs`）。
* **项目元数据** —— `package.json` 中的 `license`、`author`、`repository`、`bugs`、
  `homepage`、`keywords`、`engines`，以及新增的 `typecheck` 脚本。

### 变更

* **预览图** —— `preview.png` 使用 ffmpeg/libwebp 以质量 88 重新编码为 `preview.webp`
  （保留完整 2323×1372 分辨率）：3.4 MB → 384 KB，减少 89%。
* 新增 `.editorconfig` 与 `.gitattributes`：文本文件统一为 LF，生成产物
  （`index.js`、`functions/pic.js`、`public/counts.json`）在 diff 中默认折叠。
* `.gitignore` 改为忽略整个 `public/` 生成池（仅保留 `counts.json` 与静态资源），
  新增分类自动覆盖。

### 修复

* 同步 `functions/pic.js` 与 `index.js` 至 `gen_img.py` 的输出 —— 提交版本丢失了一个空行
  与文件末尾换行，现由新增的 CI 校验把关。
* 移除画廊中失效的「按 `type` 重置 state」effect：`app/page.tsx` 已使用
  `key={galleryType}` 渲染该组件，切换分类时本就会整体重挂载并重置状态。
* 将画廊与主题切换中「在 effect 内 setState」的水合门控改为 `useSyncExternalStore`，
  避免每次挂载产生级联渲染。
* 为 Fancybox 插件选项（`Thumbs`、`Toolbar`）补上类型声明，替换原先的 `as any` 断言。

### 安全

* 单文件 5MB 的构建限制可避免超大素材在哈希扩散阶段耗尽 CI 磁盘空间。
  漏洞报告方式见 [SECURITY.zh.md](SECURITY.zh.md)。

[Unreleased]: https://github.com/RolinShmily/SrP-IMG/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/RolinShmily/SrP-IMG/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/RolinShmily/SrP-IMG/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/RolinShmily/SrP-IMG/releases/tag/v0.1.0
