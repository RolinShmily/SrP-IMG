# SrP-IMG — 随机图片API 🖼️

一个基于Cloudflare Pages 和 Transform Rules，提供两种图片获取方式的**无限流量**、**零成本**、**多分类**随机图片API。

灵感来源：

- [cf-rule-random-url](https://github.com/afoim/cf-rule-random-url)
- [EdgeOne_Function_PicAPI](https://github.com/afoim/EdgeOne_Function_PicAPI)

## 总体说明 ✅

- 使用 `gen_img.py` 预生成按分类（例如 `h`、`v`）的十六进制命名图片集合。
- 默认生成路径：`dist/<category>/<hex>.<ext>`（例如 `dist/h/000.jpg`）。
- 开发时使用 `--no-copy` 生成占位文件以加快本地迭代；生产使用 `--hash-length 3`（16³ = 4096）以覆盖随机空间。 🛠️

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

## 使用示例 🔗

**注意**：

- JS重定向方式不局限于Cloudflare Pages部署
- 但URL重写方式需要在Cloudflare Pages部署

### JS重定向

- 随机横图： `https://<your-domain>/pic?img=h` ↔️
- 随机竖图： `https://<your-domain>/pic?img=v` ↕️
- 根据 UA 自动选择： `https://<your-domain>/pic?img=ua` 📱

### URL重写

- 随机横图： `https://<your-domain>/h` ↔️
- 随机竖图： `https://<your-domain>/v` ↕️
- 自定义图库： `https://<your-domain>/<category>` 📱

## 部署（Cloudflare Pages） ☁️

### 素材准备

- 在仓库根 `oriImg/` 为每个分类创建子目录，例如：

```
oriImg/
├── h/    # 横屏图片
└── v/    # 竖屏图片
```

- 把你自己的图片上传到相应的分类目录（支持 `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` 等常见格式）。
- 命名不限：构建脚本会按循环分配并生成十六进制命名的输出文件到 `dist/`。

### 构建命令

```powershell
# 占位符生成（开发） 🧪
python3 gen_img.py --no-copy --hash-length 3

# 生产构建：复制真实图片到 dist/ 🚀
python3 gen_img.py --hash-length 3
```

这样 `gen_img.py` 会把素材扩充为 `dist/<category>/<hex>.<ext>` 并生成 `functions/pic.js` 与 `dist/counts.json`，可直接部署到 Pages。

**注**：`--hash-length`的参数可以为`1`、`2`、`3`...，分别对应`16`、`256`、`4096`...个输出值。

## (可选) Cloudflare Transform Rules 🔁

**注**:此部分对应URL重写方法，需要你的CI为Cloudflare Pages。

1. Cloudflare → Rules → Transform Rules → Create rule → Rewrite URL
2. 设置传入请求匹配表达式(将`<your-domain>`改写为你的域名)：
```text
(http.host eq "<your-domain>" and not starts_with(http.request.uri.path, "/pic") and not ends_with(http.request.uri.path, ".jpg"))
```
3. 设置路径重写(Path Rewrite)方式为Dynamic，写入表达式：
```text
concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 3), ".jpg")
```

**注意**：如果你的构建命令中`--hash-length`值为`2`,那么这里`cf.random_seed`的随机范围右边界也要从`3`改为`2`。

规则编写完成后，当访问 `https://<your-domain>/<category>`时，Cloudflare 内部重写为 `dist/<category>/<hex>.<ext>`，并返回其内容而URL不变。

