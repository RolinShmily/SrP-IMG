# SrP-IMG — Cloudflare Pages 随机图片静态服务 🖼️

这是一个用于演示和部署到 Cloudflare Pages 的静态随机图片生成/重定向项目。

## 总体说明 ✅

- 使用 `gen_img.py` 预生成按分类（例如 `h`、`v`）的十六进制命名图片集合。
- 构建时会把元数据（`counts` / `hash_length` / `output_ext`）注入到 `functions/pic.js`，以便 Cloudflare Pages Functions 在边缘返回 302 重定向到随机图片，无需运行时读盘。 ⚡
- 默认生成路径：`dist/<category>/<hex>.<ext>`（例如 `dist/h/000.jpg`）。
- 开发时可使用 `--no-copy` 生成占位文件以加快本地迭代；生产建议使用 `--hash-length 3`（16³ = 4096）以覆盖随机空间。 🛠️

## 仓库结构（简要） 📁

```text
├── oriImg/           # 原始素材（每个子目录为一个分类，如 h/ v/）
├── dist/             # 构建产物（部署此目录）
│   ├── h/            # 横屏图片（hex 命名）
│   ├── v/            # 竖屏图片（hex 命名）
│   └── counts.json   # 构建时生成的元数据
├── functions/        # Cloudflare Pages Functions（生成后可直接部署）
│   └── pic.js        # 由 gen_img.py 生成的 server-side 重定向函数
├── gen_img.py        # 构建脚本（生成 dist/ 与 functions/pic.js）
└── README.md
```

## 构建产物 📦

- `dist/counts.json` — 包含 `counts` / `hash_length` / `output_ext` / `domain` / `generated_at`
- `functions/pic.js` — Pages Function（server-side），已注入 `counts` 和 `hash_length`；部署后可通过 `/pic?img=...` 使用
- `dist/<category>/` — 每个分类目录包含按 hex 命名的图片（占位或真实）

## 示例（部署后） 🔗

- 随机横图： `https://<your-domain>/pic?img=h` ↔️
- 随机竖图： `https://<your-domain>/pic?img=v` ↕️
- 根据 UA 自动选择： `https://<your-domain>/pic?img=ua` 📱↔️

## 部署建议（Cloudflare Pages） ☁️

- 推荐流程：在本地运行 `gen_img.py` 生成 `dist/`，然后将 `dist/` 或整个仓库部署到 Pages；Pages 会自动识别 `functions/` 下的脚本并部署为 Pages Functions。
  -- 如果使用 Pages 的 Git 集成，注意不要意外将大量占位/真实图片推送到主分支（会导致仓库膨胀）。
  -- 推荐做法：在本地或 CI 中生成 `dist/` 并将 `dist/` 发布到 Pages；将原始素材保留在本地 `oriImg/` 目录中，不要直接把大量图片提交到主分支。

如何准备你的素材（放到 `oriImg/`）

- 在仓库根创建 `oriImg/`（如果尚未存在），并为每个分类创建子目录，例如：

```
oriImg/
├── h/    # 横屏图片
└── v/    # 竖屏图片
```

- 把你自己的图片上传到相应的分类目录（支持 `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` 等常见格式）。
- 命名不限：构建脚本会按循环分配并生成十六进制命名的输出文件到 `dist/`。
- 本地构建示例（PowerShell）：

```powershell
# 占位符生成（开发/演示） 🧪
python gen_img.py --no-copy --hash-length 3

# 生产构建：复制真实图片到 dist/ 🚀
python gen_img.py --hash-length 3
```

这样 `gen_img.py` 会把素材扩充为 `dist/<category>/<hex>.<ext>` 并生成 `functions/pic.js` 与 `dist/counts.json`，可直接部署到 Pages。

## Cloudflare Transform Rules（可选，改写直接到静态图） 🔁

如果要把路径 `/h`、`/v` 等直接映射到随机图片（无需函数），可使用 Transform Rules 的 Rewrite URL：

1. Cloudflare → Rules → Transform Rules → Create rule → Rewrite URL
2. 设置匹配：例如 `URI Path` matches `^/[a-zA-Z0-9_-]+$`
3. Path Rewrite（Dynamic 方式），输入表达式：

```text
concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 3), ".jpg")
```

使用：直接访问 `https://<your-domain>/<category>`，Cloudflare 内部重写为 `dist/<category>/<hex>.<ext>`

> **注意**：如果你使用 `cf.random_seed` 的方式取 `0-2` 位（即长度为 2），那么生成脚本的 `--hash-length` 参数也应设置为 `2`。 🔢
