# 贡献指南

<p align="center">
  <a href="./CONTRIBUTING.md">English</a> • <b>简体中文</b>
</p>

感谢你愿意为本项目出力。这是一个小项目 —— 一个静态 Vite + React 画廊加上一个负责随机跳转的
Cloudflare Worker —— 因此流程刻意保持轻量。

## 可以怎么参与

* **缺陷反馈**：提交 [Issue](https://github.com/RolinShmily/SrP-IMG/issues)，并附上平台、浏览器以及出错的完整 URL 或命令。
* **功能建议**：先开 Issue 说明使用场景，方案达成一致后再动手写代码。
* **Pull Request**：欢迎小而聚焦的修复与改进。
* **图片版权**：请**不要**作为代码 Issue 提交，参见 [README_zh](./README_zh.md#-开源协议) 中的说明。

## 本地环境

依赖：**Node.js 22+** 与 **Python 3.8+**。

```bash
git clone https://github.com/RolinShmily/SrP-IMG.git
cd SrP-IMG
npm ci --ignore-scripts

# 只生成虚拟元数据、不拷贝图片（开发时推荐，速度快）
python -m pipeline --no-copy --hash-length 2

npm run dev          # http://localhost:5173
npm run lint         # eslint .（flat config 位于 eslint.config.mjs）
npm run build        # Vite 多入口生产构建，输出到 dist/
npm run typecheck    # tsc --noEmit；vite build 不做类型检查
npm test             # 管线 + 访问策略 + Worker 契约 + 差分矩阵
```

> `pipeline/` 会同步重写 `worker/targets.js` 与 `worker/slot_formats.js`，使它们与生成的
> 哈希空间及源文件真实格式一致。若你修改了管线或 `worker/`，请连同重新生成的数据模块一起提交。

## 新增图片或分类

1. 新建 `assets/original/<分类>/` 并放入图片（建议压缩到 **2MB** 以内；超过 **5MB** 的文件会被构建跳过）。
2. `h`、`v` 固定输出 `.jpg`，其他分类沿用该目录首张图片的后缀。
3. 在 `src/pages/home.tsx` 增加对应切换按钮，并在 `src/components/image-gallery.tsx` 的
   `typeToFolder` 映射表中增加条目。
4. 运行管线，提交 `assets/generated/counts.json` 以及重新生成的 `worker/targets.js`
   与 `worker/slot_formats.js`。

请只提交你有权分发的图片，不要提交抓取来的素材。

## Pull Request 要求

* 一个 PR 只解决一件事，说明**改了什么**与**为什么改**。
* 不要提交任何密钥（`.env`、API Token、Cloudflare 凭据）。部署工作流从 GitHub 仓库
  Secrets 读取，严禁硬编码。
* 保持 `package-lock.json` 与 `package.json` 同步；新增依赖前请在 PR 描述中说明。
* 影响用户可见行为时，请同时更新 `README.md` 与 `README_zh.md`。
* 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)
  （`feat:`、`fix:`、`docs:`、`chore:`、`refactor:`），与现有历史保持一致。

## 报告安全问题

发现漏洞请**不要**提交公开 Issue，请按 [SECURITY.zh.md](./SECURITY.zh.md) 的方式私下联系。

## 疑问

可以开 [Issue](https://github.com/RolinShmily/SrP-IMG/issues)，或邮件至
<contact@srprolin.com>。
