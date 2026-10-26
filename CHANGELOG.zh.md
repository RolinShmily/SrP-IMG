# 更新日志

<p align="center">
  <a href="./CHANGELOG.md">English</a> • <b>简体中文</b>
</p>

本文件记录本项目所有值得注意的变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

* **防盗链与访问策略配置化** —— 引入根目录 `access-policy.json`，支持 Referer 白名单、空 Referer 放行策略、CORS Origin 及图片直链保护配置。构建时由 `gen_img.py --access-policy` 自动内嵌至 Worker 与 Pages 代码中。
* **可视化访问策略配置面板** —— 在 `/settings` 页面新增交互式配置卡片，支持实时格式校验、当前站点快捷添加、JSON 预览、一键复制与配置文件直接下载。
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

[Unreleased]: https://github.com/RolinShmily/SrP-IMG/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RolinShmily/SrP-IMG/releases/tag/v0.1.0
