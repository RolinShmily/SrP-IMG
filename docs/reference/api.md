# 运行时 API 契约

三个入口最终都指向同一个资产：`/pic?img=<key>`（302 跳转）、`/<category>/<hex>.<ext>`（直链）、`/<category>`（边缘重写，见 [transform-rules.md](./transform-rules.md)）。本文只描述前两者在运行时真正发出的状态码与响应头；所有判定逻辑集中在 `worker/policy.js`，路由分发在 `worker/index.js`。

## 1. 入口与分发

| 请求路径 | 处理路径 | 出处 |
| --- | --- | --- |
| `/pic` | `handleRequest(request, env)` | `worker/index.js` |
| `/api/pic` | `handleRequest(request, env)`，与 `/pic` 完全同一实现 | `worker/index.js` |
| `/pic`（Pages Functions 部署时） | `functions/pic.js` → `worker/pages.js::onRequest` | `functions/pic.js` |
| `/<category>/<hex>.<ext>` | 资产保护分支（`parseCategoryImage` 命中） | `worker/index.js` |
| 其它路径 | 直接 `env.ASSETS.fetch(request)` | `worker/index.js` |

Pages 适配器只覆盖 `/pic`；`/api/pic` 需要单独的 Pages 路由，静态图片保护需要 Pages middleware 或边缘规则（`worker/pages.js`）。

## 2. `/pic?img=<key>`

`img` 的解析顺序是硬编码的（`worker/policy.js::resolveTarget`）：

| `img` 取值 | 结果 | 出处 |
| --- | --- | --- |
| `h` / `v` / `a` / `gif` | 当前 `TARGETS` 的四个键 | `worker/targets.js` |
| `ua` | UA 分流，**先于** `TARGETS` 查找，因此同名的 `ua` 分类会被遮蔽 | `worker/policy.js` |
| 省略、空串、未知值 | `404` | `worker/policy.js` |
| 命中但 `slots < 1`（该分类没有有效源图） | `404` | `worker/policy.js` |
| 原型链名字（如 `toString`） | `404`，用 `hasOwnProperty` 判定 | `worker/policy.js` |

跳转目标是相对路径，不是绝对 URL（`worker/policy.js::randomImagePath`）：

```bash
curl -sI 'https://img.example.com/pic?img=h'
# HTTP/2 302
# location: /h/8d.jpg
# cache-control: private, no-store
# vary: Origin, Referer
```

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://img.example.com/pic?img=nope'
# 404
curl -s -o /dev/null -w '%{http_code}\n' 'https://img.example.com/api/pic?img=h'
# 302（与 /pic 同一实现）
```

槽位计算为 `Math.floor(Math.random() * slots)`，十六进制左补零到 `HASH_LENGTH`，后缀取 `target.ext || IMAGE_EXT`，目录名经 `encodeURIComponent`（`worker/policy.js`）。

## 3. `img=ua` 的 UA 分流

移动端判定是单个不区分大小写的正则，命中顺序即书写顺序（`worker/policy.js`）：

```text
/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i
```

命中 → `TARGETS.v`；未命中 → `TARGETS.h`；两者缺失则 `|| null` → `404`（`worker/policy.js`）。判据只有 `User-Agent` 请求头，空 UA 视为非移动端。

```bash
curl -sI -A 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' \
  'https://img.example.com/pic?img=ua' | grep -i '^location'
# location: /v/1c.jpg
curl -sI -A 'curl/8' 'https://img.example.com/pic?img=ua' | grep -i '^location'
# location: /h/57.jpg
```

## 4. 状态码

| 状态码 | 触发条件 | 响应体 | 出处 |
| --- | --- | --- | --- |
| `302` | 命中目标且 `slots >= 1`，带 `Location` | 空 | `worker/policy.js` |
| `404` | 未知/缺失 `img`、`slots < 1`、Origin 被拒、Referer 被拒 | `404 Not Found` | `worker/policy.js` |
| `405` | 方法不在 `GET` / `HEAD` / `OPTIONS`；预检的 `Access-Control-Request-Method` 不是 `GET` / `HEAD` | `405 Method Not Allowed` 或 `405 Preflight Method Not Allowed` | `worker/policy.js` |
| `204` | `OPTIONS` 预检通过 | 空 | `worker/policy.js` |
| `400` | `Access-Control-Request-Headers` 含非法字段名字符 | `400 Invalid Preflight Headers` | `worker/policy.js` |
| `500` | 环境变量非法（fail closed）、处理器抛错 | `500 Internal Error` | `worker/policy.js` |

判定顺序是 Origin → 方法 → 预检 → Referer，因此一个被拒 Origin 的 `POST` 得到的是 `404` 而不是 `405`（`worker/policy.js::checkAccess`）。

## 5. 方法限制与预检

| 方法 | 结果 | 出处 |
| --- | --- | --- |
| `GET` / `HEAD` | 正常处理；`HEAD` 无响应体但保留全部头 | `worker/policy.js` |
| `OPTIONS` | `204` + `Access-Control-Allow-Methods: GET, HEAD, OPTIONS` + `Access-Control-Max-Age: 86400` | `worker/policy.js` |
| 其它（`POST` / `PUT` / `DELETE` …） | `405` + `Allow: GET, HEAD, OPTIONS` | `worker/policy.js` |

`Access-Control-Request-Headers` 只在字段名匹配 `^[!#$%&'*+.^_\x60|~0-9A-Za-z-]+$` 时原样反射，绝不反射任意输入（`worker/policy.js`）。

```bash
curl -si -X OPTIONS 'https://img.example.com/pic?img=h' \
  -H 'Origin: https://img.example.com' -H 'Access-Control-Request-Method: GET'
# 204，含 access-control-allow-methods / access-control-max-age / access-control-allow-origin
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'https://img.example.com/pic?img=h'
# 405，allow: GET, HEAD, OPTIONS
```

## 6. 响应头

| 响应头 | 值 | 适用范围 | 出处 |
| --- | --- | --- | --- |
| `Vary` | `Origin, Referer`；预检额外加 `Access-Control-Request-Method`、`Access-Control-Request-Headers` | 全部 `/pic`、`/api/pic` 与受保护资产 | `worker/policy.js::responseHeaders` |
| `Cache-Control` | `private, no-store` | 同上；未受保护直链沿用 `_headers` 的 `public, max-age=31536000, immutable` | `worker/policy.js`、`assets/static/_headers` |
| `Access-Control-Allow-Origin` | 反射请求的 `Origin`，仅当 `allowedOrigin` 为真 | 同上；无 `Origin` 头时不发 | `worker/policy.js` |
| `Access-Control-Allow-Methods` | `GET, HEAD, OPTIONS` | 仅 `204` | `worker/policy.js` |
| `Access-Control-Allow-Headers` | 反射 `Access-Control-Request-Headers` | 仅 `204` 且语法合法 | `worker/policy.js` |
| `Access-Control-Max-Age` | `86400` | 仅 `204` | `worker/policy.js` |
| `Allow` | `GET, HEAD, OPTIONS` | 仅 `405` | `worker/policy.js` |
| `X-Content-Type-Options` | `nosniff` | 由 `assets/static/_headers` 的 `/*` 规则附着在静态资产响应上，随 `env.ASSETS.fetch` 结果透传；`/pic` 自己构造的响应**没有**这个头 | `assets/static/_headers` |
| `Content-Type` | `text/plain; charset=utf-8`（错误体）或纠正后的图片 MIME | 见下一节 | `worker/policy.js`、`worker/index.js` |

上表最后一行的 `X-Content-Type-Options` 由平台在 `env.ASSETS.fetch` 阶段按 `_headers`
附加，`worker/index.js` 只保留 `asset.headers`。`wrangler dev` 实测：`/h/00.jpg` 的响应同时带有
Worker 写入的 `Vary` / `Cache-Control` 与平台附加的 `nosniff`；`/pic` 自己构造的响应没有这个头。

`responseHeaders` 会先删掉所有 `Access-Control-Allow-*` 再按策略重新设置，因此资产自带通配 CORS 头不会泄漏；`Access-Control-Allow-Credentials` 从不设置（`worker/policy.js`）。

```bash
curl -sI 'https://img.example.com/pic?img=h' -H 'Origin: https://img.example.com' \
  | grep -i '^access-control-allow-origin'
# access-control-allow-origin: https://img.example.com
curl -sI 'https://img.example.com/pic?img=h' | grep -ci 'x-content-type-options'
# 0（/pic 不走 _headers）
```

## 7. 直链 `/<category>/<hex>.<ext>`

`parseCategoryImage` 的三个条件同时满足才会进入保护分支：`decodeURIComponent` 后恰好三段、第二段是 `TARGETS` 的自有键、第三段匹配 `/\.(?:jpe?g|png|gif|webp)$/i`（`worker/index.js`）。因此 `/a/counts.json`、`/a/00.avif`、`/a/` 都不会被策略拦截。

`Content-Type` 纠正只在三个前提下发生：资产响应 `response.ok`、槽位是十六进制数字、`SLOT_FORMATS[category]` 在该下标处有已知代码（`worker/index.js`）。

| 格式代码 | `Content-Type` | 出处 |
| --- | --- | --- |
| `j` | `image/jpeg` | `worker/index.js::SLOT_MIME` |
| `p` | `image/png` | 同上 |
| `g` | `image/gif` | 同上 |
| `w` | `image/webp` | 同上 |
| `?` | 不纠正，保留资产原始头（无证据不改写） | `pipeline/formats.py`、`worker/index.js` |

`404` / `304` 不纠正，错误体不会冒充图片；非十六进制文件名（如手放的 `missing.jpg`）仍然受策略保护，但不纠正 MIME（`worker/index.js`）。

```bash
curl -sI 'https://img.example.com/a/01.jpeg'
# HTTP/2 200
# content-type: image/webp        （当前 slot_formats.js 中 a 的第 1 槽为 w）
# cache-control: private, no-store
# vary: Origin, Referer
# x-content-type-options: nosniff
```

`PROTECT_ASSET_IMAGES=0` 时该分支只做 `Content-Type` 纠正，头完全来自资产（immutable 缓存、无 `Vary`）（`worker/index.js`）。保护分支必须依赖 `assets.run_worker_first: true`，否则资产命中会绕过 Worker（`worker/index.js`、`wrangler.jsonc`）。

## 8. 拒绝与"没有这张图"不可区分

Origin 被拒、Referer 被拒、key 未知、`slots` 为空，四种情况都返回同一个 `404` 与同一句 `404 Not Found`，不带任何原因（`worker/policy.js`）。这是刻意设计：`403` 加原因会让人可以逐条试探 allowlist。配置非法的 `500` 也只回 `500 Internal Error`，真实原因只进 `console.error`（`worker/policy.js::misconfigured`）。

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Referer: https://evil.test/' 'https://img.example.com/pic?img=h'
# 404，体为 404 Not Found —— 与 img=nope 同码同体
```

推论：看到 `404` 时无法区分"这个分类不存在"和"我被防盗链挡了"，排查要先看 Referer/Origin 是否命中策略，见 [configuration.md](./configuration.md)。
