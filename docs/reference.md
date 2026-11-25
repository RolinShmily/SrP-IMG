# 接口、配置与产物参考

本文提供运行时 HTTP API 契约、配置项明细、生成物数据格式，以及 Cloudflare Transform Rules 边缘重写配方。

## 1. 运行时 API 契约

三种入口最终指向同一份图片池，共享访问策略与 MIME 纠正：

| 路径 | 处理分支 | 说明 |
| :--- | :--- | :--- |
| `/pic?img=<key>` | `worker/index.js::handleRequest` | 返回 `302` 到随机槽位相对路径 |
| `/<category>/<hex>.<ext>` | 资产保护分支（`parseCategoryImage` 命中） | 返回图片并按 `SLOT_FORMATS` 纠正 `Content-Type` |
| `/<category>`（可选） | Cloudflare Transform Rules 重写后进入直链分支 | 地址栏保持 `/<category>`，无 302 跳转 |
| 其它路径 | `env.ASSETS.fetch(request)` | HTML、`/counts.json`、`/static/*`、`/fonts/*` 直接透传 |

### `/pic?img=<key>` 目标解析

- `img=ua` **优先于** `TARGETS` 查找：按正则 `/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i` 匹配 `User-Agent`，命中返回 `TARGETS.v`，否则返回 `TARGETS.h`。
- 其它值按 `Object.prototype.hasOwnProperty` 查 `TARGETS`（如 `h`、`v`、`a`、`gif` 或自定义分类）；缺失、未知或 `slots < 1` 均返回 `404`。
- `Location` 为相对路径（如 `/h/8d.jpg`），槽位随机取 `[0, slots)` 的小写十六进制并左补零至 `HASH_LENGTH`。

### 状态码与方法限制

判定顺序为 **Origin → 方法 → 预检 → Referer**（因此非法 Origin 的 `POST` 会返回 `404` 而非 `405`）：

| 状态码 | 触发条件 | 响应体 |
| :--- | :--- | :--- |
| `302` | `/pic` 命中目标且 `slots >= 1` | 空（带 `Location`） |
| `204` | `OPTIONS` 预检通过 | 空（带 `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`、`Access-Control-Max-Age: 86400`） |
| `400` | `OPTIONS` 的 `Access-Control-Request-Headers` 含非法 header 字符 | `400 Invalid Preflight Headers` |
| `404` | 未知/缺失 `img`、空分类、Origin 被拒、Referer 被拒 | `404 Not Found` |
| `405` | 非 `GET`/`HEAD`/`OPTIONS`，或预检请求方法非 `GET`/`HEAD` | `405 Method Not Allowed`（带 `Allow`） |
| `500` | 策略环境变量配置非法（fail closed）或内部异常 | `500 Internal Error` |

### 响应头与安全边界

- **策略响应头**：受策略保护的响应（`/pic` 及 `PROTECT_ASSET_IMAGES=1` 时的图片直链）统一清除上游 `Access-Control-Allow-*`，覆写 `Cache-Control: private, no-store`、`Vary: Origin, Referer`；仅在 `Origin` 存在且被允许时回显 `Access-Control-Allow-Origin`，永不设置 `Access-Control-Allow-Credentials`。
- **MIME 纠正**：`response.ok` 且槽位为合法十六进制时，按 `worker/slot_formats.js` 的格式码（`j`→`image/jpeg`、`p`→`image/png`、`g`→`image/gif`、`w`→`image/webp`）覆写 `Content-Type`；`?`、404/304、非十六进制文件名保持原头。
- **静态资产头**：`assets/static/_headers` 的 `X-Content-Type-Options: nosniff` 随 `env.ASSETS.fetch` 透传到图片响应；`/pic` 自行构造的 302 不附带该头。
- **拒绝不可区分与边界**：Origin/Referer 拒绝与「图片不存在」返回完全相同的 `404 Not Found`，配置错误详情只进 `console.error`，防止探测规则。Referer/Origin 头可被非浏览器客户端伪造，访问策略用于防随手盗链而非身份认证。

---

## 2. 配置参考

### 运行时环境变量（`worker/policy.js`）

生产环境通过 `npx wrangler secret put <NAME>` 或 Cloudflare Dashboard 注入，**不写入 `wrangler.jsonc` 的 `vars`**；本地开发复制 `.dev.vars.example` 为 `.dev.vars`。

| 变量 | 默认值 | 含义 |
| :--- | :--- | :--- |
| `REFERER_ENABLED` | `true` | 是否开启 Referer 检查 |
| `REFERER_ALLOW_MISSING` | `true` | 是否放行无 `Referer` 请求（直接访问、curl、Markdown） |
| `REFERER_ALLOW_SAME_ORIGIN` | `true` | 是否放行同源 `Referer` |
| `REFERER_ALLOWED_HOSTS` | 空 | 允许主机列表：精确域名/IP 或 `*.example.com`（只匹配子域，不含裸域） |
| `CORS_ALLOW_SAME_ORIGIN` | `true` | 是否放行同源 `Origin` |
| `CORS_ALLOWED_ORIGINS` | 空 | 允许 Origin 列表：精确 `http(s)://host[:port]`，禁止通配符、路径或尾斜杠 |
| `PROTECT_ASSET_IMAGES` | `true` | 是否对 `/<category>/<file>` 图片直链启用策略与 `private, no-store` |

- **语法**：布尔支持 `1/0`、`true/false`、`yes/no`、`on/off`（大小写不敏感，空值取默认）；列表以逗号或空白分隔、自动小写去重；IPv6 写裸地址不带方括号，IPv4 禁止通配。
- **fail closed**：任意变量格式非法会导致整站返回 `500 Internal Error`，绝不静默降级放行。

### `wrangler.jsonc`

关键字段：`main: "worker/index.js"`、`assets.directory: "./dist"`、`assets.binding: "ASSETS"`、`assets.run_worker_first: true`、`workers_dev: false`、`preview_urls: false`、`routes` 指向自定义域。文件故意省略 `vars` 防止白名单明文入库。

### `assets/catalog.json`

分类注册表，键为分类目录名，每项含 `label`、`name_zh`、`name_en`、`description`、`ext_policy`：

- `"default"`：采用 `--ext`（默认 `.jpg`，当前 `h`/`v` 使用）
- `"source"`：采用首张有效源文件的后缀（未登记的自定义目录默认采用此策略）
- `".suffix"`：固定字面后缀（当前 `a` 为 `".jpeg"`、`gif` 为 `".gif"`）

### `pipeline` CLI 参数

`python -m pipeline [--hash-length N] [--ext .jpg] [--no-copy] [--strict-formats]`

- `--hash-length, -l`（默认 `2`）：槽位十六进制长度，槽位数 $= 16^L$。
- `--ext, -e`（默认 `.jpg`）：`ext_policy: "default"` 分类的后缀。
- `--no-copy`：写出 1×1 占位图而非拷贝源图（仅限 CI / 测试）。
- `--strict-formats`：零写入前置检查，源文件真实格式与槽位后缀不一致时退出码 `1`。

### `assets/static/_headers`

- `/h/*`、`/v/*`、`/a/*`、`/gif/*`、`/fonts/*`：`Cache-Control: public, max-age=31536000, immutable`（仅在 `PROTECT_ASSET_IMAGES=0` 时对图片生效；字体更新需改名）。
- `/static/*`（Vite 产物）：**刻意不设**长缓存，避免 `_headers` 按路径匹配将瞬时 404 缓存一年。
- `/counts.json`：`Cache-Control: public, max-age=0, must-revalidate`。
- `/*`：`X-Content-Type-Options: nosniff`。

### 改动副作用速查

| 改动 | 影响 |
| :--- | :--- |
| 修改 `--hash-length` | 所有槽位 URL 变化，须同步修改 Transform Rules 的 `substring` 长度 |
| 修改 `--ext` 或 `ext_policy` | 对应分类槽位后缀与 URL 变化，须同步修改 Transform Rules 并重跑生成 |
| `PROTECT_ASSET_IMAGES=0` | 直链跳过策略检查并恢复 1 年 immutable 缓存 |
| `run_worker_first: false` | 静态资产绕过 Worker，访问策略与 MIME 纠正**静默失效** |
| 修改 `catalog.json` 显示名 | 仅影响展示与 `counts.json`，不改变 URL 与 `generated_at` |

---

## 3. 生成物契约

| 产物 | 入库 | 生产者 | 消费者 |
| :--- | :--- | :--- | :--- |
| `assets/generated/counts.json` | 是 | `pipeline/manifest.py` | 前端 `/counts.json`、`tests/` |
| `assets/generated/<cat>/<hex>.<ext>` | 否 | `pipeline/pool.py` | Vite `closeBundle` → `dist/` |
| `worker/targets.js` | 是 | `pipeline/worker_targets.py` | `worker/index.js`、`worker/policy.js` |
| `worker/slot_formats.js` | 是 | `pipeline/worker_targets.py` | `worker/index.js` |
| `dist/**` | 否 | `vite build` | `wrangler deploy` |

### `assets/generated/counts.json`

受 [`assets/manifest.schema.json`](../assets/manifest.schema.json)（JSON Schema 2020-12，`additionalProperties: false`）约束，顶层 9 个字段按固定顺序写出：

`categories`（每项含 `key`、`name_zh`、`name_en`、`ext`、`count`、`slots`、`aspect`、`aspect_hint`）、`counts`（槽位数）、`real_counts`（有效源图数）、`category_exts`、`category_aspects`、`slot_ratios`（每槽宽高比数组，长度等于 `slots`）、`hash_length`、`output_ext`、`generated_at`（ISO-8601 UTC，六内容键未变时复用旧值）。

### `worker/targets.js` 与 `worker/slot_formats.js`

- `worker/targets.js`：导出 `HASH_LENGTH`、`IMAGE_EXT` 与 `TARGETS`（`{ dir, slots, ext, label }`），按排序键以 `JSON.parse("...")` 写出纯数据。
- `worker/slot_formats.js`：导出 `SLOT_FORMATS`，每分类一个等长字符串（第 `i` 位为槽位 `i` 的格式码 `j/p/g/w/?`，空分类为 `""`），与 `targets.js` 同步写出。

### `dist/` 结构

```text
dist/
├── index.html  gallery.html  settings.html
├── static/        # Vite 内容哈希 JS/CSS bundle（assetsDir: "static"）
├── fonts/         # geist-latin.woff2、geist-mono-latin.woff2
├── icon.svg  placeholder.svg  _headers
├── counts.json
└── a/  gif/  h/  v/   # 各分类十六进制槽位文件
```

---

## 4. 边缘重写（Cloudflare Transform Rules）

在 *Cloudflare Dashboard → Rules → Transform Rules → Rewrite URL* 中为每个分类创建一条精确匹配规则（替换 `<your-domain>`）：

| 分类 | 匹配表达式 | 路径重写（Dynamic） |
| :--- | :--- | :--- |
| `h` | `(http.host eq "<your-domain>" and http.request.uri.path eq "/h")` | `concat("/h/", substring(uuidv4(cf.random_seed), 0, 2), ".jpg")` |
| `v` | `(http.host eq "<your-domain>" and http.request.uri.path eq "/v")` | `concat("/v/", substring(uuidv4(cf.random_seed), 0, 2), ".jpg")` |
| `a` | `(http.host eq "<your-domain>" and http.request.uri.path eq "/a")` | `concat("/a/", substring(uuidv4(cf.random_seed), 0, 2), ".jpeg")` |
| `gif` | `(http.host eq "<your-domain>" and http.request.uri.path eq "/gif")` | `concat("/gif/", substring(uuidv4(cf.random_seed), 0, 2), ".gif")` |

如需同时匹配尾斜杠（如 `/h/`），把路径条件写成 `(http.request.uri.path eq "/h" or http.request.uri.path eq "/h/")`，重写表达式仍必须使用字面前缀 `concat("/h/", ...)` 以免拼出 `/h//xx.jpg`。

### 规则设计要点与排坑

- **为什么用 `eq`**：
  - `matches` 正则需 Business / WAF Advanced 套餐，免费套餐不可用；`eq` 全套餐支持。
  - **禁止用 `starts_with("/a")`**：曾命中旧的 `/assets/*` bundle 导致整站白屏（现 bundle 已迁至 `/static/`，但前缀匹配仍不安全）。
  - **禁止用 `not ends_with(".jpg")` 终止**：会锁死全站单后缀，否则 `.gif`/`.jpeg` 会触发递归重写。
- **三条同步约束**：重写后缀须等于 `assets/catalog.json` 的 `ext_policy`；`substring` 长度须等于 `--hash-length`（且 `<= 8` 以免切到 UUID 的 `-`）；必须保持 `assets.run_worker_first: true`。
- **白屏排查**：执行 `curl -sI https://<your-domain>/static/<bundle>.js`，若为 404 检查是否存在过宽的 `starts_with` 规则；修正后强制刷新或清理对应 URL 缓存。
- **缓存与 Purge**：默认 `PROTECT_ASSET_IMAGES=1` 下响应带 `private, no-store`，无需清缓存；若曾以 `PROTECT_ASSET_IMAGES=0` 运行，图片被缓存 1 年，更新后需在 Dashboard 清理对应缓存。

### 验证命令

```bash
curl -sI https://<your-domain>/h                     # 200, image/*, private no-store, Vary
curl -sI https://<your-domain>/counts.json           # 200, public max-age=0 must-revalidate
curl -s -o /dev/null -w '%{http_code}\n' https://<your-domain>/pic?img=h   # 302
```
