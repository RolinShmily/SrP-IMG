# 运行时：Worker 内部

`worker/index.js` 只做路由，`worker/policy.js` 是唯一的策略引擎；单入口（Workers）只有一份实现（`worker/index.js`、`worker/policy.js`）。

## 1. 入口路由

| 条件 | 动作 | 出处 |
| :--- | :--- | :--- |
| 路径是 `/pic` | 交给 `handleRequest`（策略 + 目标解析 + 302） | `worker/index.js` |
| 其余路径 | 先 `resolvePolicy(env)`；出错返回 500 | `worker/index.js` |
| `parseCategoryImage` 返回 `null` | 原样 `env.ASSETS.fetch(request)`，不加任何头 | `worker/index.js` |
| `PROTECT_ASSET_IMAGES` 为假 | 取资产，只纠正 `Content-Type` | `worker/index.js` |
| `PROTECT_ASSET_IMAGES` 为真 | `checkAccess` → 取资产 → 重建响应头 → 纠正 `Content-Type` | `worker/index.js` |

`parseCategoryImage` 的判定链：`decodeURIComponent`（失败即 `null`）→ 必须正好三段 → 第二段必须是 `TARGETS` 的自有键 → 第三段必须匹配 `/\.(?:jpe?g|png|gif|webp)$/i` → 十六进制前缀解析为槽位号，解析不出则 `slot = null`（`missing.jpg` 这类手放文件保持原行为）（`worker/index.js`）。

## 2. 三种入口为什么都经过 Worker

| 入口 | 初始形态 | 经过 Worker 的原因 |
| :--- | :--- | :--- |
| `/pic?img=<key>` | Worker 直接处理 | 入口就在 Worker |
| `/<category>/<hex>.<ext>` | 静态资产 | `assets.run_worker_first: true` |
| `/<category>` | 边缘重写后变成静态资产 | 重写后的请求同样先到 Worker |

三条入口最终都变成同一种资产请求，因此访问策略、`Vary`/`Cache-Control` 与 MIME 纠正对它们完全一致（`wrangler.jsonc`、`docs/reference/transform-rules.md`；见 [data-flows.md](data-flows.md)）。

## 3. 策略引擎

| 组成 | 行为 | 出处 |
| :--- | :--- | :--- |
| 配置来源 | 七个环境变量：`REFERER_ENABLED`、`REFERER_ALLOW_MISSING`、`REFERER_ALLOW_SAME_ORIGIN`、`REFERER_ALLOWED_HOSTS`、`CORS_ALLOW_SAME_ORIGIN`、`CORS_ALLOWED_ORIGINS`、`PROTECT_ASSET_IMAGES` | `worker/policy.js` |
| 缓存 | 模块级单槽 `policyCache`，键是七个值的 `join('\u0000')`；同一配置只解析一次 | `worker/policy.js` |
| 失败关闭 | 非法布尔值、非法 host、非法 origin 抛错 → 缓存 `error` → 500，绝不"放开" | `worker/policy.js` |
| 错误信息 | 原因只写 `console.error`，响应体永远是 `500 Internal Error` | `worker/policy.js` |
| 拒绝语义 | Origin/Referer 不通过一律回 `404 Not Found`，与"图片不存在"不可区分 | `worker/policy.js` |
| 方法 | 仅 `GET`/`HEAD`/`OPTIONS`；其余 `405` 并带 `Allow` | `worker/policy.js` |
| 预检 | `OPTIONS` → `204`、`Access-Control-Allow-Methods`、`Access-Control-Max-Age: 86400`；请求方法不是 `GET`/`HEAD` 回 405；请求头名不合法回 400 | `worker/policy.js` |
| `Vary` | 合并既有值后强制加入 `Origin`、`Referer`；预检再追加 `Access-Control-Request-*` | `worker/policy.js` |
| 缓存头 | 一律覆写 `Cache-Control: private, no-store` | `worker/policy.js` |
| CORS 回显 | 先删除资产带来的 `Access-Control-Allow-*`，仅在 Origin 存在且被允许时回显该 Origin | `worker/policy.js` |

通配符只在域名上成立：`*.example.com` 匹配点边界下的任意层级子域，但**不**匹配 `example.com` 本身；CORS origin 逐字比较，出现 `*` 直接判配置非法（`worker/policy.js`）。Referer/Origin 是客户端头，这层只抬高随手盗链的成本，不是身份认证（`worker/policy.js` 头注释）。

`policyCache` 是"每个 isolate 一份"的缓存，请求内不再重新解析；配置改动在下一次冷启动或不同 isolate 上生效，代码本身不监听配置变更（`worker/policy.js`）。

## 4. 资产保护分支

```
checkAccess(request, policy)           // 拒绝 → 404/405/400
await env.ASSETS.fetch(request)        // 命中或未命中都继续
new Response(HEAD ? null : asset.body, {
  status: asset.status,
  statusText: asset.statusText,
  headers: responseHeaders(request, policy, asset.headers),
})
withSlotContentType(...)               // 仅 response.ok 生效
```

要点：`HEAD` 时显式传 `null` body 但保留头部；`responseHeaders` 会覆盖 `_headers` 给出的长缓存；异常走 `catch` → `errorResponse(..., 500, 'Internal Error')`（`worker/index.js`）。`assets/static/_headers` 里 `/h/*`、`/v/*`、`/a/*`、`/gif/*` 的 `public, max-age=31536000, immutable` 只在未开启资产保护时生效，这是"静态优先"与"每次过策略"之间的显式取舍（`assets/static/_headers`、`docs/reference/transform-rules.md`）。

## 5. `withSlotContentType`

| 条件 | 结果 | 出处 |
| :--- | :--- | :--- |
| `!response.ok` | 原样返回，404/304 保留自己的头 | `worker/index.js` |
| `SLOT_FORMATS[category]` 不是字符串 | 原样返回 | `worker/index.js` |
| `slot` 不是整数或超出字符串长度 | 原样返回 | `worker/index.js` |
| 格式码是 `?`（头部不可识别） | `SLOT_MIME` 查不到 → 原样返回 | `worker/index.js`、`pipeline/formats.py` |
| 其余 | 克隆头，`headers.set('Content-Type', mime)` | `worker/index.js` |

`SLOT_MIME` 只映射 `j`/`p`/`g`/`w`；"没有证据就不改写"是刻意的，避免把错误类型强加给未识别的字节（`worker/index.js`、`pipeline/formats.py`）。`HEAD` 请求同样走这条路径，因为纠正后的头必须出现在 HEAD 响应里（`worker/index.js`）。

## 6. `run_worker_first` 是承重配置

`wrangler.jsonc` 里 `assets.run_worker_first: true`，配合同一文件的注释：改成资产优先，存在的文件会被直接返回，访问策略与 MIME 纠正同时静默失效（`wrangler.jsonc`、`worker/index.js` 的 `requires assets.run_worker_first` 注释）。

| 配置 | 策略 | MIME 纠正 | 长缓存 |
| :--- | :--- | :--- | :--- |
| `run_worker_first: true`（当前） | 生效 | 生效 | 被 `private, no-store` 覆盖 |
| 资产优先 | 失效 | 失效 | 生效 |

## 7. 行为锚点

`tests/worker/source-equivalence.test.mjs` 用同一组请求、env 与 `ASSETS` stub 驱动旧生成入口与新 `worker/index.js`，逐条比较状态码、头与体；唯一允许的差异是"某个槽位的真实字节与后缀不符时的 `Content-Type`"，并且这个差异被单独断言（`tests/worker/source-equivalence.test.mjs`）。旧入口从 `HEAD` 上消失后，该用例自动跳过，其余契约由 `tests/backend-contract.test.mjs` 继续覆盖（`tests/worker/source-equivalence.test.mjs`、`.github/workflows/ci.yml`）。
