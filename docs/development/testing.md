# 测试

四套测试按"谁的契约"切边界，互不重复：管线行为、运行时策略、HTTP 契约、以及一次性的新旧运行时差分。一起跑：`npm test`（`package.json`）。

## 总览

| 套件 | 语言 / 框架 | 用例数 | 管什么 | 单独运行 |
| --- | --- | --- | --- | --- |
| `tests/pipeline/test_pipeline.py` | Python `unittest` | 31 个 `test_` 方法 | 扫描、槽位、清单契约、扩展名策略、时间戳复用、空扫描零写入、门禁基线 | `python tests/pipeline/test_pipeline.py` |
| `tests/test_access_policy.py` | Python `unittest` | 8 | 部署值不进仓库、两个入口都读文档化的 env 名、`targets.js` 与清单一致 | `python tests/test_access_policy.py` |
| `tests/backend-contract.test.mjs` | Node `node:test` + 真实 `http` server | 16（`worker`/`pages` 各 6 + 4 个独立） | 状态码、响应头、CORS 预检、`no-store`、策略拒绝不可区分、`Content-Type` 纠正 | `node --test tests/backend-contract.test.mjs` |
| `tests/worker/source-equivalence.test.mjs` | Node `node:test` | 2 个 `test()`，主矩阵 1640 次请求对比 | 手写运行时 vs `git show HEAD:index.js` 的逐请求差分 | `node --test tests/worker/source-equivalence.test.mjs` |

`npm test` 的顺序是 Python 两套在前、`node --test` 两套在后，任一失败即中断（`package.json`）。

## 1. 管线测试（`tests/pipeline/test_pipeline.py`）

全部在 `tempfile.TemporaryDirectory()` 里造合成源文件，再用 `subprocess` 调 `python -m pipeline`，因此不碰仓库的真实图片池（`tests/pipeline/test_pipeline.py`）。覆盖的关键断言：

| 断言 | 意义 |
| --- | --- |
| 只读文件头拿宽高 / 真实格式 | `get_image_size`、`detect_format` 按魔数判定，`unsupported` 一律视为"无证据"而非不匹配 |
| 后缀与字节不符 | 默认只报告，槽位仍按目录后缀命名；`--strict-formats` 时退出码 1 且零写入 |
| `slot_formats.js` 跟随槽位循环 | 奇数/偶数槽的格式码按源文件排序轮转，空分类为 `""` |
| 清单契约 | `validate_manifest` 拒绝缺字段、负数、无点后缀、多余键、非数值比例 |
| 空扫描 | 不创建 `assets/generated/`、不创建 `worker/`；只有空目录时 `counts` 里出现 `0` |
| 时间戳复用 | 输入（图片集合、`--ext`）不变时 `generated_at` 不变 |
| 陈旧槽位清理 | 只删该分类下的陈旧槽位文件，同级目录与 `assets/static`、手写 `index.js`、`functions/pic.js` 原样保留 |

两个门禁测试类：

- `BaselineGateSemanticsTests`：证明 `assert_no_growth` 本身"可降不可涨"，且未列入的分类必须为 0（新增同构分类自动通过）。
- `GeneratedArtifactGateTests`：对仓库真实数据跑基线——`SOURCE_MISMATCH_BASELINE = {"a": 56, "gif": 0, "h": 43, "v": 7}`、`SLOT_MISMATCH_BASELINE = {"a": 125, "gif": 0, "h": 81, "v": 28}`；同时验证 `targets.js` / `slot_formats.js` 能由清单与源树重新推导出同样字节。

数值只准降、不准升：修好一批后缀漂移就把常量调低；数字上升意味着新的漂移随提交混入而没有决策记录（`tests/pipeline/test_pipeline.py` 注释）。

## 2. 访问策略测试（`tests/test_access_policy.py`）

读源码文本做静态断言，不启动运行时：所有文档化的 env 名都出现在 `worker/policy.js`，`worker/index.js` 与 `worker/pages.js` 都经由 `./policy.js`，五个运行时源文件里不出现 `ACCESS_POLICY`、`allowedHosts: [`、`srprolin` 等写死的值（`tests/test_access_policy.py`）。另有一条几何约定：`slot_ratios` 每个分类的长度必须等于槽位数，否则画廊会重新出现回流。

## 3. HTTP 契约测试（`tests/backend-contract.test.mjs`）

用 `node:http` 起真实服务器，把 `worker/index.js`（`fetch(request, env)`）与 `functions/pic.js`（`onRequest(context)`）分别接到同一组 `ASSETS` stub 上，两种模式各跑一遍（`tests/backend-contract.test.mjs`）。

重点不是"能返回 200"，而是这些不变量：

- 拒绝与"图片不存在"完全同形：状态码与响应体都是 `404` + `404 Not Found` + `text/plain; charset=utf-8`，无法逐条探测允许名单。
- 所有策略响应都带 `Vary: Origin, Referer` 与 `Cache-Control: private, no-store`；预检再加 `Access-Control-Request-Method` / `-Headers`。
- 非法 env 值 fail closed（500），而不是放行。
- `Content-Type` 必须描述槽位真实字节：从 `SLOT_FORMATS` 里现取"匹配槽"和"漂移槽"，而不是写死快照。
- `wrangler.jsonc` 必须保持 `assets.run_worker_first: true` 且没有 `vars`（部署值只能来自 secret）。

## 4. 差分矩阵（`tests/worker/source-equivalence.test.mjs`）

`before()` 里执行 `git show HEAD:index.js`，把上一代生成出来的单文件入口临时落到系统临时目录，再与仓库里手写的 `worker/index.js` 用同一请求、同一 env、同一 `ASSETS` stub 逐项比对（`tests/worker/source-equivalence.test.mjs`）。

| 维度 | 取值 |
| --- | --- |
| env 组合 | 10 套（默认、可信名单、关闭 Referer、禁止缺失 Referer、关闭资产保护、4 套非法值） |
| 路径 | 15 条（两套 API、四个分类、编码路径、缺失文件、`/counts.json`、`/`、`/nope`） |
| 头变体 | 10 种（无头、同源/可信/通配/被拒/非法 Referer、同源/允许/被拒/非法 Origin） |
| 方法用例 | 12 条（`HEAD`、`POST`、`OPTIONS` 预检与请求头校验） |
| UA 用例 | 2 条（移动端与桌面端 UI 分流） |

比对的例外只有一处：302 的 `Location` 只比形状（分类、扩展名、槽位十六进制长度），因为槽位本身是随机的；`Content-Type` 的纠正是**有意的**差异，测试会断言旧包输出后缀 MIME、新包输出真实 MIME（`tests/worker/source-equivalence.test.mjs`）。

**提交后自动 skip**：一旦 `HEAD` 里不再有 `index.js`，`git show` 非零退出，`legacy` 为 `null`，测试直接 `t.skip()`（同上文件与 `.github/workflows/ci.yml` 注释）。这使它成为一次性的迁移证据，而不是长期回归测试——长期回归靠前三套。

## 新增一个测试

| 要测什么 | 放哪 | 做法 |
| --- | --- | --- |
| 管线某条行为 | `tests/pipeline/test_pipeline.py` | 用 `write_tree()` 造合成源（只需要文件头字节），`run_pipeline(work, ...)` 后读 `counts.json` 与槽位目录；不要指向 `assets/original/` |
| 清单字段契约 | 同上，`SchemaTests` | 复制 `manifest()` 后 `mutate`，断言 `validate_manifest` 抛 `ManifestError` |
| 运行时某条策略 | `tests/backend-contract.test.mjs` | 用 `start(mode, env)` 拿 `api.request()`，两种模式都覆盖；断言同时含状态码、`Vary`、`Cache-Control` |
| 漂移基线变化 | `tests/pipeline/test_pipeline.py` 的 `BaselineGateSemanticsTests` / `GeneratedArtifactGateTests` | 只允许把常量改小；新增同构分类不需要改测试 |

## 为什么 CI 用 `--no-copy`

`.github/workflows/ci.yml` 生成步骤是 `python -m pipeline --no-copy --hash-length 2`：

| 理由 | 说明 |
| --- | --- |
| 速度 | 真拷贝会产生 1 GB 量级的槽位文件；占位图让 job 在分钟级完成 |
| 元数据等价 | `counts.json`、`targets.js` 与真跑逐字节一致 |
| `slot_formats.js` 等价 | 它只由源文件头派生，与是否拷贝无关（`ci.yml` 注释） |
| 后续步骤需要 `dist/` 完整 | `npm run build` 依赖 `assets/generated/` 存在；占位目录同样满足 build 插件的检查 |
| 风险隔离 | CI 在干净检出里跑，占位图不会覆盖任何真实图片池 |

本地不要复制这条命令到仓库根执行，原因见 [build.md](build.md) 的"危险操作"。
