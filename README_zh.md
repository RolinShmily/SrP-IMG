# SrP-IMG — 全功能随机图片 API & 画廊

<p align="center">
  <a href="./README.md">English</a> • <b>简体中文</b>
</p>

<p align="center">
  <a href="https://github.com/RolinShmily/SrP-IMG/actions/workflows/deploy.yml"><img alt="Deploy Worker" src="https://github.com/RolinShmily/SrP-IMG/actions/workflows/deploy.yml/badge.svg"></a>
  <a href="https://github.com/RolinShmily/SrP-IMG/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/RolinShmily/SrP-IMG/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-3DA639.svg"></a>
  <a href="https://nextjs.org"><img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000.svg"></a>
  <a href="https://workers.cloudflare.com"><img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020.svg"></a>
</p>

基于 **Cloudflare Pages / Workers** 部署的**无限流量、零成本、多分类**随机图片解决方案。它通过 Python 预构建技术，将静态存储转化为高性能动态随机 API，并提供一个现代化的瀑布流画廊展示界面。

### ✨ 核心亮点

* **零成本方案**：完全托管于 Cloudflare Pages/Workers，无需传统服务器，无需数据库。
* **智能多分类**：支持 `h` (横屏)、`v` (竖屏) 以及自定义分类（如 `gif`、`a` 头像、`wallpaper` 壁纸）。
* **动态后缀支持**：`h/v` 固定为 `.jpg` 确保 API 客户端通用兼容性，其他自定义分类自动探测并保留原图后缀（如 `.gif`, `.png`）。
* **自动化画廊**：前端画廊通过读取 `counts.json` 自动适配分类、数量和文件格式，无需手动修改前端展示代码。
* **双模式调用**：支持服务端 JS 重定向 (API 模式) 与边缘 URL 重写 (无感模式)。

---

### 📁 目录结构

```text
├── oriImg/                 # [核心] 原始素材目录（按分类子文件夹组织）
│   ├── h/                  # 横屏图片素材（强转为 .jpg）
│   ├── v/                  # 竖屏图片素材（强转为 .jpg）
│   ├── a/                  # 头像图片素材
│   └── gif/                # 自定义分类（自动保留 .gif 后缀）
├── public/                 # 静态资源与构建产物目录
│   ├── counts.json         # 自动生成的全站索引与元数据
│   └── h/、v/、a/、gif/     # 映射后的十六进制图片集合
├── functions/              # Cloudflare Pages Functions
│   └── pic.js              # 服务端随机重定向接口（Pages）
├── app/                    # Next.js App Router
│   ├── page.tsx            # 画廊主页面
│   └── layout.tsx          # 根布局与元数据配置
├── components/             # React UI 组件
│   └── image-gallery.tsx   # 核心瀑布流画廊组件（映射表逻辑）
├── gen_img.py              # 构建大脑：哈希扩散、后缀识别与元数据导出
├── index.js                # Cloudflare Workers 入口
├── wrangler.jsonc          # Cloudflare Workers 配置文件
├── README.md               # 英文说明文档
└── README_zh.md            # 中文说明文档
```

---

### 🖥️ 前端预览

![preview](preview.png)

---

### 🚀 部署指南

#### 1. 素材准备

在根目录 `oriImg/` 下创建分类文件夹：

* **API 专用分类**：创建 `h` 和 `v` 目录，放入横/竖屏图片（输出时会统一固定为 `.jpg`，确保兼容所有 API 客户端）。
* **自定义分类**：创建如 `gif`、`anime`、`a` 等目录。脚本会自动取该目录首张图片的后缀作为该分类的输出后缀。

#### 2. 本地测试

如果您想在本地预览画廊效果，请执行：

```bash
# 使用 --no-copy 快速生成虚拟元数据进行测试
python gen_img.py --no-copy --hash-length 2
npm run dev
```

#### 3. Cloudflare Pages / Workers 生产构建

在 Cloudflare Pages 仪表板配置如下：

* **框架预设**：`Next.js`
* **构建命令**：

```bash
python3 gen_img.py --hash-length 2 && npm run build
```

* **输出目录**：`out`
* **环境变量**：确保 Python 环境为 3.8+

如果使用 **Cloudflare Workers**，配置根目录的 `wrangler.jsonc`：

```jsonc
{
  "name": "srp-img-worker",
  "main": "index.js",
  "compatibility_date": "2026-01-05",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./out",
    "binding": "ASSETS"
  }
}
```

*注意：请将 `name` 改为你要部署的 Worker 名称；将 `compatibility_date` 改为你的部署日期。*
部署命令：`npx wrangler deploy`

---

### 💡 使用方式

#### 方式 A：服务端 API (JS 重定向)

由生成的 `functions/pic.js` (Pages) 或 `index.js` (Workers) 提供支持，适合在 Markdown 或外部网页中直接引用：

| 功能描述              | 调用地址        | 返回结果                       |
| :-------------------- | :-------------- | :----------------------------- |
| **随机横图**    | `/pic?img=h`  | 302 重定向至`/h/xxx.jpg`     |
| **随机竖图**    | `/pic?img=v`  | 302 重定向至`/v/xxx.jpg`     |
| **UA 智能分流** | `/pic?img=ua` | 手机端返回竖图，电脑端返回横图 |

#### 方式 B：前端可视化画廊

访问部署后的根域名（如 `https://your-domain.pages.dev`）：

* **自动适配**：顶部导航会自动切换 `h`、`v`、`gif` 等分类。
* **瀑布流展示**：基于 Next.js 的高性能瀑布流动态加载。
* **沉浸式预览**：集成 Fancybox，支持缩放、旋转、全屏及一键下载。

#### 方式 C：URL 重写 (无感随机)

需在 Cloudflare 仪表板手动配置 **Transform Rules**（*请将下列表达式中的 `<your-domain>` 替换为实际域名*）：

**规则一：横竖屏分类 (`h` / `v`)**

1. **匹配表达式**：

```text
(http.host eq "<your-domain>" and starts_with(http.request.uri.path, "/h") and not ends_with(http.request.uri.path, ".jpg")) or (http.host eq "<your-domain>" and starts_with(http.request.uri.path, "/v") and not ends_with(http.request.uri.path, ".jpg"))
```

2. **路径重写至 (Dynamic)**：

```text
concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 2), ".jpg")
```

**规则二：头像分类 (`a`)**

1. **匹配表达式**：

```text
(http.host eq "<your-domain>" and starts_with(http.request.uri.path, "/a") and not ends_with(http.request.uri.path, ".jpeg"))
```

2. **路径重写至 (Dynamic)**：

```text
concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 2), ".jpeg")
```

**规则三：GIF 分类 (`gif`)**

1. **匹配表达式**：

```text
(http.host eq "<your-domain>" and starts_with(http.request.uri.path, "/gif") and not ends_with(http.request.uri.path, ".gif"))
```

2. **路径重写至 (Dynamic)**：

```text
concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 2), ".gif")
```

> **注意**：如果构建命令中 `--hash-length` 值为 `3`，则此处 `cf.random_seed` 截取长度右边界也需从 `2` 改为 `3`。
> 访问示例：`https://your-domain.pages.dev/h`

---

### ⚙️ 技术参数细节

#### 关于 `gen_img.py`

脚本执行时会进行以下操作：

1. **哈希扩散**：通过 `--hash-length` 指定随机空间。若设为 `3`，每个分类会生成 $16^3 = 4096$ 个访问路径。
2. **后缀策略**：
   * 扫描 `oriImg` 下的所有子目录。
   * 若目录名为 `h` 或 `v`，输出后缀强制遵循命令行参数（默认 `.jpg`）。
   * 否则，自动探测该目录首张图片的后缀并保留。
3. **元数据导出**：生成 `counts.json`，记录每个分类的图片总数 (`counts`) 和对应后缀 (`category_exts`)。

---

### 📦 存储与容量管理 (关键说明)

由于 Cloudflare Pages 及其他 CI/CD 平台对单次构建的文件总数和总体积有严格限制，本项目引入了**体积熔断机制**：

#### 1. 文件体积限制

* **5MB 阈值**：构建脚本 `gen_img.py` 会在扫描阶段检查每个源文件。
* **策略**：任何单文件体积超过 **5MB** 的图片将被直接忽略，不会被拷贝，也不会参与哈希迭代。
* **原因**：防止超大 GIF 或高清素材在指数级迭代（如 $16^3 = 4096$ 倍）后瞬间耗尽磁盘空间。

#### 2. 容量计算公式

在配置 `--hash-length` 时，请参考以下公式评估预期的磁盘占用：

$$
S_{total} = \sum_{c=1}^{n} (16^L \times \bar{S}_c)
$$

* $S_{total}$：构建后的总磁盘占用。
* $L$：命令行指定的 `hash-length`（默认 3）。
* $\bar{S}_c$：分类 $c$ 中**所有合规图片 ($\le 5\text{MB}$)** 的平均体积。
* $n$：分类文件夹的总数。

> **示例计算**：若 `h` 分类有 10 张图，平均每张 500KB，`hash-length` 为 3：
> 占用空间 $= 16^3 \times 500\text{KB} = 4096 \times 0.5\text{MB} \approx 2\text{GB}$。

#### 3. 最佳实践建议

* **预先压缩**：建议在放入 `oriImg` 之前，使用批量压缩工具（如 [Caesium Image Compressor](https://saerasoft.com/caesium/) 或 TinyPNG、FFmpeg）将素材压缩至 2MB 以内。
* **动态调整**：如果素材库较大，可将 `--hash-length` 设为 `2`（每个分类生成 256 张），以确保平台构建顺利。
* **查看日志**：在构建日志中，脚本会明确输出：`[分类名] 忽略了 X 个超过 5.0MB 的文件`。

---

### 🎨 关于画廊映射表

画廊组件内部使用 `typeToFolder` 映射表进行解耦。若需增加新分类，仅需：

1. 在 `oriImg/` 新建对应文件夹。
2. 在 `app/page.tsx` 增加对应的切换按钮。
   前端会自动匹配 `counts.json` 中的后缀与数量配置，无需修改底层图片加载逻辑。

---

### 🤝 参与贡献与安全

欢迎参与贡献 —— 本地环境、素材要求与 PR 规范见 [CONTRIBUTING.zh.md](CONTRIBUTING.zh.md)，
行为准则见 [CODE_OF_CONDUCT.zh.md](CODE_OF_CONDUCT.zh.md)，版本变更记录见 [CHANGELOG.zh.md](CHANGELOG.zh.md)。

如需报告安全漏洞，请按 [SECURITY.zh.md](SECURITY.zh.md) 私下联系，不要提交公开 Issue。

---

### 📜 开源协议

本项目的**源代码**基于 **MIT 协议** 开源 —— 详见 [LICENSE](LICENSE) 全文。该协议**不覆盖图片资源**，具体说明见下文。欢迎 Star 关注！

#### 图源与版权说明

**本仓库的 MIT 协议仅覆盖源代码**（`.ts` / `.tsx` / `.js` / `.py` 及配置文件等），
**不覆盖 `oriImg/` 目录以及构建产物中的任何图片资源**。

* `oriImg/` 下的图片均收集自互联网，版权归**各自原作者**所有，仅用于个人学习、功能演示与技术验证。
* 本仓库不对这些图片主张任何权利，也未获得原作者的明确授权。
* 由于本仓库并不持有这些图片的著作权，因此 MIT 协议**不会、也无法**向任何人授予这些图片的使用权。如需用于商业用途或公开分发，请自行向原作者取得授权。
* 如果你是某张图片的版权方且不希望它出现在此仓库，请提交 [Issue](https://github.com/RolinShmily/SrP-IMG/issues) 告知，确认后我会尽快移除。

> **给部署者的建议**：请将 `oriImg/` 替换为你自有的图片，或已确认授权条款的图源（如 Unsplash、Pexels、Pixabay），并遵守其各自的授权要求。

#### 灵感来源与致谢

本项目的接口设计参考了以下项目。仅参考了公开的接口设计与总体思路，未复制其源码，
实现为独立编写：

1. **[EdgeOne_Function_PicAPI](https://github.com/afoim/EdgeOne_Function_PicAPI)** by [@afoim](https://github.com/afoim) — 提供了 EdgeOne / Cloudflare Functions 服务端无服务器随机图片重定向接口的设计参考。该项目遵循 **AGPL-3.0** 许可开源；本项目未包含其代码。
2. **[cf-rule-random-url](https://github.com/afoim/cf-rule-random-url)** by [@afoim](https://github.com/afoim)
   启发了基于 Cloudflare Transform Rules 边缘重写与十六进制哈希扩散实现无感随机图的核心设计。
