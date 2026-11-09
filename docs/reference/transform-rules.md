# 边缘重写（Cloudflare Transform Rules）

SrP-IMG 有意保留**三种入口**指向同一份图片池，并且三者并存：

| 入口 | 示例 | 最终响应 |
|---|---|---|
| 边缘重写（本篇） | `/h` | Transform Rules 重写到随机槽位，再由 Worker 包装 |
| Worker API | `/pic?img=h`（含 `/api/pic`） | Worker 返回 `302` → 槽位 |
| 画廊 / 直链 | `/h/00.jpg` | 槽位本身，同样经过 Worker |

三条路径落到同一份资产，因此访问策略、缓存头与 `Content-Type` 纠正
（`worker/slot_formats.js`）对它们完全一致。

## 一、规则

在 *Cloudflare Dashboard → Rules → Transform Rules → Rewrite URL* 里，**每个分类建一条**规则。
把 `<your-domain>` 换成你的 zone。

**`h` — 横屏**

```text
# 匹配
(http.host eq "<your-domain>" and http.request.uri.path eq "/h")

# 路径重写（Dynamic）
concat("/h/", substring(uuidv4(cf.random_seed), 0, 2), ".jpg")
```

**`v` — 竖屏**

```text
# 匹配
(http.host eq "<your-domain>" and http.request.uri.path eq "/v")

# 路径重写（Dynamic）
concat("/v/", substring(uuidv4(cf.random_seed), 0, 2), ".jpg")
```

**`a` — 头像**

```text
# 匹配
(http.host eq "<your-domain>" and http.request.uri.path eq "/a")

# 路径重写（Dynamic）
concat("/a/", substring(uuidv4(cf.random_seed), 0, 2), ".jpeg")
```

**`gif` — 动图**

```text
# 匹配
(http.host eq "<your-domain>" and http.request.uri.path eq "/gif")

# 路径重写（Dynamic）
concat("/gif/", substring(uuidv4(cf.random_seed), 0, 2), ".gif")
```

重写后路径变成 `/h/ab.jpg`，不再匹配 `^/h/?$`，所以规则不会递归；浏览器地址栏仍是 `/h`。

## 二、为什么用路径形状，而不是扩展名

这套规则最初（0.1 之前）用 `not ends_with(http.request.uri.path, ".jpg")` 终止，有两个问题：

1. **锁死单一后缀**：一旦某个分类用 `.gif` 或 `.jpeg`，重写后的 `/gif/0a.gif` 不再以 `.jpg` 结尾，
   规则会再次触发，产出 `/gif/0a.gif/3f.jpg`。要让规则成立，所有分类就必须共用一个后缀——
   这就是"源图必须预先转成目标格式"那条约定的来源。当前代码里已经没有任何层依赖后缀唯一性
   （Worker 按分类算 `Location`，`_headers` 按路径，画廊按 `counts.json` 取后缀）。
2. **`starts_with` 太宽**：`starts_with(path, "/a")` 也会命中 `/assets/main-abc123.js`（Vite 产物），
   把站点自己的 CSS/JS 重写成 `/assets/main-abc123.js/3f.jpeg`，整站白屏。`^/a/?$` 只匹配精确路径。

**`eq` 精确匹配**同时解决两点：与后缀无关、不会递归、不会外溢到其它路由。

> **套餐可用性**：`matches`（正则）需要 **Business / WAF Advanced** 套餐，免费版会报
> `not entitled: the use of operator Matches is not allowed`。`eq` 在所有套餐可用。
> 想让 `/h/`（带尾斜杠）也生效，可写成
> `(http.request.uri.path eq "/h" or http.request.uri.path eq "/h/")`；
> 重写表达式务必用字面前缀（`concat("/h/", …)`），不要用 `concat(http.request.uri.path, "/", …)`，
> 否则 `/h/` 会拼出 `/h//xx.jpg` 并被 307 归一化。

### 症状与排查

如果首页/画廊变成空白页，先在浏览器或命令行确认 bundle：

```bash
curl -sI https://<your-domain>/assets/<bundle>.js   # 期望 200
```

- **`/assets/*` 返回 404**：说明有一条前缀过宽的规则把它也改写了——最常见的是 `/a` 规则用了
  `starts_with(..., "/a")`，而 `/assets/…` 同样以 `/a` 开头。把该规则改成
  `http.request.uri.path eq "/a"` 即可恢复。
- 规则改好后如果仍白屏，是浏览器/边缘缓存了那份 404：`_headers` 给 `/assets/*` 设了
  `immutable`，清缓存或强制刷新后才会重新拉取。

## 三、约束

| 约束 | 说明 |
|---|---|
| 重写表达式里的后缀 = 该分类的 `ext_policy` | `h`/`v` 用 `--ext`（默认 `.jpg`）、`a` 用 `.jpeg`、`gif` 用 `.gif`、自定义分类取首个源文件后缀。改 `assets/catalog.json` 或 CLI 参数时必须同步改规则 |
| `substring` 长度 = `--hash-length` | 构建用 `2`（256 槽位），因此是 `0, 2`；用 3 则改 `0, 3`（4096 槽位）。保持 `N ≤ 8`，否则会切到 UUID 的 `-` |
| 必须保持 `assets.run_worker_first: true` | 重写后的请求仍会经过 Worker，由它执行访问策略、写 `Vary`/`Cache-Control`，并按 `worker/slot_formats.js` 纠正 `Content-Type`。改成资产优先会同时失去策略与 MIME 纠正 |
| 自定义分类 | 要么按它的后缀加一条规则，要么直接用 `/pic?img=<category>` 跳过规则层 |
| 规则条数 | 动态重写规则按 zone 有配额限制，四条通常远低于上限 |

## 四、验证

```bash
# 重写返回一个槽位，并带上策略头与纠正后的 MIME
curl -sI https://<your-domain>/h
# -> 200, content-type: image/jpeg, cache-control: private, no-store,
#    vary: Origin, Referer

# 连续两次应得到不同槽位（比较 ETag）
curl -sI https://<your-domain>/h | grep -i etag
curl -sI https://<your-domain>/h | grep -i etag

# 站点自身的 bundle 必须仍能加载 —— 这是旧 /a 规则会打断的地方
curl -sI https://<your-domain>/assets/<bundle>.js

# 不受影响的路径
curl -sI https://<your-domain>/counts.json
curl -s -o /dev/null -w '%{http_code}\n' https://<your-domain>/pic?img=h   # 302
```

## 五、缓存与 purge

| 场景 | 图片响应的缓存头 | 发布后是否需要 purge |
|---|---|---|
| `PROTECT_ASSET_IMAGES=1`（默认） | Worker 写 `private, no-store` | 不需要：CDN 不缓存，规则重写后的请求同样如此 |
| `PROTECT_ASSET_IMAGES=0` | 沿用 `assets/static/_headers`：`/h|v|a|gif/*` 为 `public, max-age=31536000, immutable` | **需要**：旧响应（尤其是错误的 `Content-Type`）会按 URL 缓存一年 |

如果曾经以 `PROTECT_ASSET_IMAGES=0` 运行过，部署修复后应在 Dashboard 清除这四个前缀的缓存。
Cloudflare 的 *Purge by Prefix* 属于付费能力；免费套餐只能用 *Purge by URL*（逐槽位）或
*Purge Everything*。此外 `/assets/*` 与 `/fonts/*` 也是一年 immutable：替换字体或资源时**改名**
（或 purge），否则客户端不会重新拉取。

## 六、已知限制

- 重写表达式无法按槽位选择后缀，因此每个分类只能有一个后缀（见根 README 的
  "Extension Strategy"）。若将来引入逐槽位后缀，规则必须改为重写到 `/pic?img=<category>`——
  仍然可用，但每个请求会多一次 Worker 调用，也就失去"纯静态"的意义。
- 规则重写是内部重写，浏览器地址栏与相对链接都不受影响。
