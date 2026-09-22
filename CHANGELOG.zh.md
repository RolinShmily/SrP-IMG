# 更新日志

<p align="center">
  <a href="./CHANGELOG.md">English</a> • <b>简体中文</b>
</p>

本文件记录本项目所有值得注意的变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

暂无。

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
