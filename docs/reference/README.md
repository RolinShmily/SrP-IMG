# 参考分册导读

这一册只回答"契约是什么"：线上会返回什么、有哪些配置项、生成物长什么样、规则层怎么配。为什么这样设计属于 [../architecture/](../architecture/README.md)，日常命令属于 [../development/](../development/README.md)。

| 文档 | 内容 |
| --- | --- |
| [api.md](./api.md) | 运行时 API 契约：`/pic`、直链、UA 分流、状态码、响应头、`Content-Type` 纠正 |
| [configuration.md](./configuration.md) | 七组环境变量、`wrangler.jsonc`、`assets/catalog.json`、`pipeline` CLI、`_headers`、改动副作用 |
| [generated-files.md](./generated-files.md) | `counts.json`、`worker/targets.js`、`worker/slot_formats.js`、`dist/` 结构 |
| [transform-rules.md](./transform-rules.md) | 边缘重写（Cloudflare Transform Rules）的四条规则、约束与坑位 |

## 1. API 契约

三个入口最终都落到同一个资产：`/pic?img=<key>`（`302`）、`/<category>/<hex>.<ext>`（直链）、`/<category>`（边缘重写）。契约细节见 [api.md](./api.md)。

| 问题 | 答案 | 去哪看 |
| --- | --- | --- |
| 随机图接口有哪些 | `/pic?img=<key>`，302 重定向 | [api.md §1](./api.md) |
| 有哪些合法的 `img` 值 | `TARGETS` 的四个键加 `ua` | [api.md §2](./api.md) |
| `img=ua` 怎么判 | 单个 UA 正则，命中走 `v`，否则走 `h` | [api.md §3](./api.md) |
| 什么时候 404 / 405 / 500 | 一张状态码表，含判定顺序 | [api.md §4](./api.md) |
| 响应头有哪些 | `Vary`、`Cache-Control`、`Access-Control-*`、`Allow` | [api.md §6](./api.md) |
| 为什么后缀 `.jpg` 却是 WebP | `slot_formats.js` 的 MIME 纠正 | [api.md §7](./api.md) |
| 403 去哪了 | 拒绝一律回 `404`，与"没有这张图"不可区分 | [api.md §8](./api.md) |

## 2. 配置与生成物

配置项和产物是同一份契约的两端：配置决定产物形状，产物决定运行时行为。

| 我要查/改什么 | 文件 | 去哪看 |
| --- | --- | --- |
| 防盗链、CORS、资产保护开关 | 七个环境变量，默认值全为真 | [configuration.md §1](./configuration.md) |
| 部署拓扑、`run_worker_first` | `wrangler.jsonc` | [configuration.md §2](./configuration.md) |
| 分类标签、分类后缀 | `assets/catalog.json` 的 `ext_policy` | [configuration.md §3](./configuration.md) |
| 槽位数、默认后缀、占位图、格式审计 | `python -m pipeline` 的四个参数 | [configuration.md §4](./configuration.md) |
| 缓存与安全响应头 | `assets/static/_headers` | [configuration.md §5](./configuration.md) |
| 改一项会坏什么 | 副作用表 | [configuration.md §6](./configuration.md) |
| 前端读的分类/计数/比例 | `counts.json` 的 9 个顶层字段 | [generated-files.md §1](./generated-files.md) |
| `/pic` 认得哪些 key | `worker/targets.js` 的 `TARGETS` | [generated-files.md §2](./generated-files.md) |
| 每个槽位的真实格式 | `worker/slot_formats.js` | [generated-files.md §3](./generated-files.md) |
| 部署包里到底有什么 | `dist/` 结构 | [generated-files.md §4](./generated-files.md) |

三份产物里只有两个是入库的生成物（`worker/targets.js`、`worker/slot_formats.js`），`counts.json` 是唯一入库的池内文件，池子本身与 `dist/` 都不入库（`.gitignore`）。归属矩阵见 [../architecture/layers.md](../architecture/layers.md)。

## 3. 规则层

边缘重写绕过了 Worker 的随机逻辑，但仍然穿过 Worker 的策略与 MIME 纠正，所以它同样受 `run_worker_first: true` 约束。完整配置见 [transform-rules.md](./transform-rules.md)。

| 规则 | 要点 | 出处 |
| --- | --- | --- |
| 每分类一条 Rewrite URL | 匹配 `http.request.uri.path eq "/<category>"`，重写到 `/<category>/<hex>.<suffix>` | `transform-rules.md` §1 |
| 必须用 `eq`，不要用 `starts_with`/`matches` | `matches` 需要 Business / WAF Advanced；`starts_with("/a")` 会命中所有以 `/a` 开头的路径（历史上误伤过 `/assets/…`） | `transform-rules.md` §2 |
| 后缀必须等于 `ext_policy` | 改分类后缀要同时改规则并重生成池子 | `transform-rules.md` §3 |
| `substring` 长度必须等于 `--hash-length` | 当前 `0, 2` 对应 256 槽 | `transform-rules.md` §3 |

## 4. 排查路径

| 现象 | 先看 |
| --- | --- |
| 图片打不开、返回 `404` | Referer/Origin 是否命中 [configuration.md §1](./configuration.md)，再对照 [api.md §4](./api.md) |
| 整站 `500` | 环境变量是否写错（fail closed），[configuration.md §1](./configuration.md) |
| `Content-Type` 与后缀不符 | 这是预期行为，[api.md §7](./api.md) 与 [generated-files.md §3](./generated-files.md) |
| 改了代码线上没变 | `run_worker_first`、缓存头，[configuration.md §2](./configuration.md) |
| 池子没生成 / 构建报错 | 先跑 `npm run gen`，[generated-files.md §4](./generated-files.md) |

## 5. 约定

- 每个字段、状态码、响应头后面的反引号是出处文件；找不到出处的内容不写进本册。
- 交叉引用用相对路径，指向本仓 `docs/` 内已存在的文件。
- 本册不重复实现细节与取舍理由，那部分在 [../architecture/runtime.md](../architecture/runtime.md) 与 [../architecture/decisions.md](../architecture/decisions.md)。
