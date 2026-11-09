# 配置参考

四组配置决定运行时行为与产物形状：环境变量（每次请求读取）、`wrangler.jsonc`（部署拓扑）、`assets/catalog.json`（分类注册表）、`pipeline` CLI 参数（生成物形状）。最后一节列出"改一项会带来什么副作用"。

## 1. 运行时环境变量

七个变量全部由 `worker/policy.js::buildPolicy` 读取，因此 Workers 与 Pages 两个入口共用同一套语义。默认值是硬编码在代码里、不在仓库内的（`wrangler.jsonc` 明确说明不放 `vars`）。

| 变量 | 默认值 | 语义 | 出处 |
| --- | --- | --- | --- |
| `REFERER_ENABLED` | `true` | Referer 检查总开关；关闭后不再校验 Referer | `worker/policy.js` |
| `REFERER_ALLOW_MISSING` | `true` | 允许完全没有 `Referer` 头的请求（curl、Markdown、地址栏） | `worker/policy.js` |
| `REFERER_ALLOW_SAME_ORIGIN` | `true` | 允许 `Referer` 的 origin 等于请求 URL 的 origin | `worker/policy.js` |
| `REFERER_ALLOWED_HOSTS` | 空列表 | 白名单：精确主机名/IP 或 `*.example.com` | `worker/policy.js` |
| `CORS_ALLOW_SAME_ORIGIN` | `true` | 允许 `Origin` 等于请求 URL 的 origin | `worker/policy.js` |
| `CORS_ALLOWED_ORIGINS` | 空列表 | 白名单：精确的 `scheme://host[:port]` | `worker/policy.js` |
| `PROTECT_ASSET_IMAGES` | `true` | 是否把 `/<category>/<file>` 图片直链也纳入策略 | `worker/policy.js`、`worker/index.js` |

**布尔值语法**：`1`/`0`、`true`/`false`、`yes`/`no`、`on`/`off`，大小写不敏感；未设置、`null`、纯空白都取默认值；其它任何值抛错（`worker/policy.js::readFlag`）。

**列表语法**：逗号或任意空白（含换行）分隔，逐项 `trim` + 小写，去重、丢弃空项（`worker/policy.js::readList`）。因此列表比较是不区分大小写的。

**通配语义**：`*.example.com` 在点边界上匹配任意层级子域，但**从不匹配** `example.com` 本身（`worker/policy.js::allowedReferer` 中 `host.endsWith(pattern.slice(1)) && host !== pattern.slice(2)`）。对 IPv4 字面量使用通配符会被判为非法（`worker/policy.js::isValidHostPattern`）；IPv6 只接受不带通配符的字面量，配置里写裸地址，不带方括号。

**origin 语法**：`CORS_ALLOWED_ORIGINS` 逐字比较，必须是 `http(s)://` 且 `new URL(...).origin` 与原文小写后完全相等；含 `*`、含凭据、带尾斜杠、带路径都会被判非法（`worker/policy.js::buildPolicy`）。

**非法值 fail closed**：任一变量非法 → 所有请求返回 `500`，响应体只有 `500 Internal Error`，原因仅写入 `console.error('invalid access policy configuration:', ...)`（`worker/policy.js::resolvePolicy`）。策略按七个变量拼接值缓存，配置不变时不重复解析。

## 2. `wrangler.jsonc`

| 键 | 值 | 作用 | 出处 |
| --- | --- | --- | --- |
| `name` | `srp-img-worker` | Worker 名 | `wrangler.jsonc` |
| `main` | `worker/index.js` | Worker 入口 | `wrangler.jsonc` |
| `compatibility_date` | `2026-01-05` | 运行时兼容日期 | `wrangler.jsonc` |
| `compatibility_flags` | `["nodejs_compat"]` | Node 兼容开关 | `wrangler.jsonc` |
| `workers_dev` | `false` | 不暴露 `*.workers.dev` | `wrangler.jsonc` |
| `preview_urls` | `false` | 不生成预览 URL | `wrangler.jsonc` |
| `assets.directory` | `./dist` | 静态资产目录，即 Vite 产物 | `wrangler.jsonc`、`vite.config.ts` |
| `assets.binding` | `ASSETS` | 绑定名，代码里以 `env.ASSETS` 使用 | `wrangler.jsonc`、`worker/index.js` |
| `assets.run_worker_first` | `true` | 所有路径先过 Worker，再落到资产绑定 | `wrangler.jsonc` |
| `routes[0].pattern` / `zone_name` | `img.srprolin.com/*` / `srprolin.com` | 自定义域路由 | `wrangler.jsonc` |

文件里**故意没有** `vars`：写在这个文件里的值会明文入库，生产值应通过 `wrangler secret put NAME` 或 Dashboard 设置（`wrangler.jsonc` 注释、`.dev.vars.example`）。

## 3. `assets/catalog.json`

分类注册表，唯一的标签/格式真相来源；`pipeline/catalog.py` 读取，生成物再把结果带给前端。

| 字段 | 说明 | 出处 |
| --- | --- | --- |
| `version` | 目录版本，当前 `1`；解析器不校验它 | `assets/catalog.json`、`pipeline/catalog.py` |
| `categories` | 必须存在且为对象，键即分类 key | `pipeline/catalog.py` |
| `categories.<key>.label` | 写入 `TARGETS[key].label` | `pipeline/worker_targets.py` |
| `categories.<key>.name_zh` / `name_en` | 显示名，写入 `counts.json` 的 `categories[]` | `pipeline/manifest.py` |
| `categories.<key>.description` | 分类描述，当前只进 `CategoryResult.description`，不进 `counts.json` | `pipeline/pool.py` |
| `categories.<key>.ext_policy` | 槽位后缀策略，三选一，见下 | `pipeline/catalog.py` |

| `ext_policy` 取值 | 语义 | 出处 |
| --- | --- | --- |
| `"default"` | 用 `Config.default_ext`，即 `--ext`（默认 `.jpg`） | `pipeline/pool.py::resolve_category_extension` |
| `"source"` | 用第一个有效源文件的真实后缀，没有则退回 `default_ext` | `pipeline/pool.py` |
| `".suffix"` | 原样使用该字面后缀，与源文件实际字节无关 | `pipeline/pool.py` |

当前 `h`/`v` 是 `"default"`、`a` 是 `".jpeg"`、`gif` 是 `".gif"`（`assets/catalog.json`）。`a` 被钉死在 `.jpeg`，所以 PNG/WebP 源图会被原样复制进 `.jpeg` 槽位——这是刻意保留的，改后缀会移动所有已部署 URL（`pipeline/catalog.py` 的 TODO 注释）。

catalog 里没有的目录不会报错：`pipeline/catalog.py::unknown_spec` 用 key 本身作 `label`、`str.capitalize()` 作显示名、`"{key} 随机图片"` 作描述、`ext_policy` 取 `"source"`。

## 4. `pipeline` CLI 参数

入口 `python -m pipeline`，参数定义在 `pipeline/config.py::Config.from_args`。

| 参数 | 默认 | 作用 | 出处 |
| --- | --- | --- | --- |
| `--hash-length`, `-l` | `2` | 槽位十六进制宽度；槽位数 = `16 ** hash_length`（`2` → 256） | `pipeline/config.py` |
| `--ext`, `-e` | `.jpg` | `default_ext`；缺前导点时自动补（`__post_init__`） | `pipeline/config.py` |
| `--no-copy` | 关 | 写 `1×1` 占位图而不是复制源字节 | `pipeline/config.py`、`pipeline/pool.py` |
| `--strict-formats` | 关 | 源文件真实字节与槽位后缀不符时，在写任何产物之前以退出码 `1` 中止 | `pipeline/cli.py`、`pipeline/formats.py` |

不是 CLI 参数但同样影响生成的常量：单文件大小上限 `SIZE_LIMIT_MB = 5.0`、可接受扩展名 `('.jpg', '.jpeg', '.png', '.gif', '.webp')`、源目录 `assets/original`、输出目录 `assets/generated`、数据模块路径 `worker/targets.js`（`pipeline/config.py`）。

`npm run gen` 固定传 `--hash-length 2`（`package.json`）。

## 5. `assets/static/_headers`

由 Vite 的 `publicDir` 原样复制到 `dist/_headers`（`vite.config.ts`），只作用于静态资产响应，`/pic` 自己构造的响应不受它影响。

| 匹配 | 头 | 出处 |
| --- | --- | --- |
| `/h/*`、`/v/*`、`/a/*`、`/gif/*` | `Cache-Control: public, max-age=31536000, immutable` | `assets/static/_headers` |
| `/fonts/*` | 同上（文件名稳定，改字体要改名） | 同上 |
| Vite bundle `/static/*` | **刻意不设**长缓存：`_headers` 只按路径匹配，`immutable` 会把瞬时 404 钉住一年（`vite.config.ts` 的 `assetsDir`） | `assets/static/_headers` |
| `/counts.json` | `Cache-Control: public, max-age=0, must-revalidate` | 同上 |
| `/*` | `X-Content-Type-Options: nosniff` | 同上 |

被 `PROTECT_ASSET_IMAGES=1` 拦截的直链会把这套缓存头覆盖成 `private, no-store`，但 `X-Content-Type-Options: nosniff` 会被保留（`worker/policy.js::responseHeaders`）。

## 6. 改动副作用

| 改动 | 副作用 |
| --- | --- |
| `--hash-length` 2 → N | 槽位数与文件名宽度变化，所有已部署 URL 失效；必须同步改边缘重写的 `substring(..., 0, N)`（`transform-rules.md` §3） |
| `--ext` 或 `ext_policy` | 改变直链后缀与目录内文件名；`a`/`gif` 的钉死后缀被改动时，`transform-rules.md` 里的后缀也必须改 |
| `PROTECT_ASSET_IMAGES=0` | 直链不再过策略、恢复 immutable 缓存，任何人都能直接打图片 URL |
| `REFERER_ENABLED=0` | 关闭防盗链；`CORS_*` 仍然生效 |
| `run_worker_first: false` | 已存在的资产直接命中 CDN，策略与 `Content-Type` 纠正**静默失效**（`wrangler.jsonc`、`worker/index.js`） |
| `--no-copy` | 槽位被替换成 1×1 占位图；对真实池运行等于毁掉 1 GiB 图片（`docs/architecture/layers.md`） |
| `--strict-formats` | 只读预检，失败时 `assets/generated/` 完全未被触碰（`pipeline/cli.py`） |
| `catalog` 的 `label` / `name_*` | 只改展示与 `counts.json` 元数据，不改任何 URL（`pipeline/catalog.py`） |
| `catalog` 新增分类 | 需要 `assets/original/<key>/` 源图并重新生成；不用边缘重写就直接走 `/pic?img=<key>` |
| 环境变量写错 | 整站 `500`（fail closed），不会静默放行（`worker/policy.js`） |

相关：状态码与响应头见 [api.md](./api.md)，生成物字段见 [generated-files.md](./generated-files.md)。
