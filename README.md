# SrP-IMG — Cloudflare Pages 静态随机图片服务

本仓库使用 `gen_img.py` 预生成按分类的十六进制命名图片集合，并在构建时生成 Cloudflare Pages 可部署的 Functions（放在 `dist/functions/`）。把 `dist/` 部署到 Cloudflare Pages 后，即可提供基于 UA/分类的随机图片重定向服务。

主要说明

- 构建时会把 `counts` / `hash_length` / `output_ext` 注入到 `dist/functions/cf-redirect.js`，函数运行时无需访问文件系统。
- 开发时可使用 `--no-copy` 快速生成占位文件；生产时使用 `--hash-length 3`（4096）并复制真实图片。

目录概览

```text
├── oriImg/           # 原始图片素材（按分类，如 h, v）
├── dist/             # 构建输出（部署目录）
│   ├── functions/    # Pages Functions（gen_img.py 生成）
│   ├── ri/           # 生成的图片（hex 命名）
│   └── counts.json
├── gen_img.py        # 构建脚本
└── README.md
```

快速构建与验证（Windows PowerShell）

```powershell
cd D:\desktop\RoL1n\SrP-IMG
# 快速占位构建（hash-length=2 用于本地测试）
python gen_img.py --no-copy --hash-length 2

# 生产构建（生成 4096 个/分类，耗 IO 较大）
python gen_img.py --hash-length 3
```

快速构建会生成：

- `dist/counts.json` — 构建元数据（counts/hash_length/output_ext）
- `dist/functions/cf-redirect.js` — Pages Function（server-side），已注入 counts/hash_length
- `dist/ri/<category>/` — 生成的图片（占位或真实图片）

部署到 Cloudflare Pages

推荐流程：本地运行 `gen_img.py` 构建 `dist/`，然后把 `dist/` 的内容部署到 Pages；Pages 会自动识别并部署 `functions/` 下的脚本。

验证示例（部署后）

- 随机横图： https://<your-domain>/functions/cf-redirect?img=h
- 随机竖图： https://<your-domain>/functions/cf-redirect?img=v
- 根据 UA 自动选择： https://<your-domain>/functions/cf-redirect?img=ua

注意事项

- 我已将画廊页面（`dist/index.html`）与随机客户端脚本（`random.js` / client helper）从默认产物中移除；如果需要我可以恢复。
- 构建时内联 counts 更适合边缘运行环境，避免运行时读盘。

如果需要我可以：

- 生成 `build.ps1` 封装常用构建命令；
- 添加本地测试脚本，用于模拟 Pages `onRequest` 并验证 UA 路由。

# Cloudflare Random Image API

一个基于 Cloudflare Pages 和 Transform Rules 实现的**无限流量、零成本、多分类**随机图片 API。

## 🌟 原理

利用 Cloudflare 的边缘重写能力（Rewrite URL），将用户的分类请求（如 `/h`）动态映射到预生成的静态资源路径（如 `/h/a1b.jpg`）。整个过程在边缘节点完成，无需服务器后端，无需 Worker 调用额度。

## 📂 目录结构

```text
├── oriImg/           # 原始图片素材目录
│   ├── h/            # 示例：横屏图片分类
│   └── v/            # 示例：竖屏图片分类
├── dist/             # 生成的静态资源目录（部署此目录）
├── gen_img.py        # 资源生成脚本
└── README.md         # 说明文档
```

## 🚀 部署指南

### 1. 准备素材

在 `oriImg` 目录下建立你的分类文件夹（例如 `h`, `pc`, `mobile` 等），并将对应的图片放入其中。

> 支持 `.jpg`, `.png`, `.webp` 等常见格式。

### 2. 生成静态库

运行 Python 脚本，它会将图片扩充并重命名为十六进制哈希文件名（`000.jpg` ~ `fff.jpg`），以适配 Cloudflare 的随机逻辑。

```bash
python gen_img.py
```

_脚本会在 `dist/` 目录下生成处理好的文件，每个分类包含 4096 个文件（16^3）。_

### 3. 部署到 Cloudflare Pages

将 `dist` 目录下的内容部署到 Cloudflare Pages。

- 如果使用 Git 集成，确保 Build output directory 设置为 `dist`（如果你把 dist 提交了）或者在构建命令中运行生成脚本。
- **推荐**：直接在本地运行脚本后，将 `dist` 目录作为静态站点上传，或者仅提交 `dist` 目录内容。

### 4. 配置 Cloudflare Rules (关键)

进入你的 Cloudflare 域名管理面板：

1. 导航到 **Rules** > **Transform Rules**。
2. 点击 **Create rule**，选择 **Rewrite URL**。
3. 配置如下：

- **Rule name**: Random Image
- **Filter Expression**:

  - 建议匹配你的 API 路径，例如：
  - `URI Path` matches `^/[a-zA-Z0-9_-]+$`

