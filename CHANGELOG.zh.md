# 更新日志

<p align="center">
  <a href="./CHANGELOG.md">English</a> • <b>简体中文</b>
</p>

本文件记录本项目所有值得注意的变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

> **尚未发布任何版本标签。** `package.json` 中的版本号为 `0.1.0`，`main` 分支始终可部署，
> 但未打过任何 tag。因此以下内容均属未发布状态；打第一个 tag 时会将其移入对应版本标题下。

## [Unreleased]

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
* **社区规范文件** —— `CONTRIBUTING`、`CODE_OF_CONDUCT`、`SECURITY`、本更新日志、
  Issue 表单、PR 模板与 CI 工作流。
* **项目元数据** —— `package.json` 中的 `license`、`author`、`repository`、`bugs`、
  `homepage`、`keywords` 与 `engines`。

### 变更

* 新增 `.editorconfig` 与 `.gitattributes`，统一文本文件为 LF，并让生成产物
  （`index.js`、`functions/pic.js`、`public/counts.json`）在 diff 中默认折叠。

### 安全

* 单文件 5MB 的构建限制可避免超大素材在哈希扩散阶段耗尽 CI 磁盘空间。
  漏洞报告方式见 [SECURITY.zh.md](SECURITY.zh.md)。

[Unreleased]: https://github.com/RolinShmily/SrP-IMG/commits/main
