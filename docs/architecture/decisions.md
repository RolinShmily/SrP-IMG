# 取舍记录

每条记录四段：背景、决定、被否掉的方案、代价。已被否掉的方案仍写在文档里，因为它们是"为什么不能那样改"的依据（`CHANGELOG.md` 的 Unreleased 段是这些决定的原始记录）。

说明：`CHANGELOG.md` 记录的是结论而非逐条否决理由；下面标为"被否掉"的动机部分由代码注释、测试与文档反推，凡属反推的都已标注出处，未标注的视为待确认。

## ADR-1 用 Vite 取代 Next 静态导出

| 项 | 内容 |
| :--- | :--- |
| 背景 | 前端原本是 Next.js 静态导出，导出后还要跑一个规范化脚本处理 Windows 上的 segment prefetch 文件名；生成池仍需在导出后搬进产物目录（`CHANGELOG.md`） |
| 决定 | 换成 Vite 7 多页构建：`index.html`、`gallery.html`、`settings.html` 三个入口挂同一个 React Router SPA；`publicDir` 指向 `assets/static`，`outDir` 为 `dist`（`vite.config.ts`） |
| 被否掉 | 继续保留 Next 静态导出。`CHANGELOG.md` 只记录了替换结果，没有逐条否决理由；仓库内可见的成本是额外的文件名归一化脚本与导出后搬运生成池（`CHANGELOG.md`） |
| 代价 | 生成池在 `publicDir` 之外，dev 与 build 都得自己接：dev 中间件服务 `/counts.json` 与槽位 URL，`closeBundle` 负责拷入 `dist/`（`vite.config.ts`）；三个 HTML 入口需要手工登记到 `rollupOptions.input`（`vite.config.ts`） |

## ADR-2 把 `gen_img.py` 拆成 `pipeline/`

| 项 | 内容 |
| :--- | :--- |
| 背景 | 单个 900 行的 `gen_img.py` 同时负责扫描、分类映射、尺寸探测、槽位生成、清单、Worker 代码生成；四个分类的标签在四张 map 与一条 if/elif 链里各写一遍（`CHANGELOG.md`、`pipeline/catalog.py`） |
| 决定 | 拆成按阶段划分的模块（`config`、`catalog`、`scan`、`image_size`、`pool`、`manifest`、`worker_targets`、`cli`，后续又加入 `formats`、`placeholders`、`models`）；分类注册表移入 `assets/catalog.json`；清单固定到 `contracts/manifest.schema.json`；新增 `tests/pipeline/`（`CHANGELOG.md`、`pipeline/README.md`） |
| 被否掉 | 继续单文件 + 多份 map：同一套分类在后端四张 map、生成器 if/elif 链和前端四张 map 里重复，改一次要同步多处（`pipeline/catalog.py`） |
| 代价 | 阶段顺序与字节格式变成显式契约，只能靠外部 oracle 证明"与重构前逐字节一致"；一旦有人"顺手整理"JSON 或排序，diff 会出现在生成物而不是代码里（`pipeline/README.md`、`tests/pipeline/test_pipeline.py`） |

## ADR-3 Worker 改为手写源码，只生成数据模块

| 项 | 内容 |
| :--- | :--- |
| 背景 | 访问策略与两个入口原先由 Python f-string 生成 JS，策略逻辑藏在生成器字符串里，既不能 lint 也不能单独测试（`CHANGELOG.md`、`worker/policy.js` 头注释） |
| 决定 | `worker/index.js`、`worker/policy.js`、`worker/pages.js` 手写；`python -m pipeline` 只写 `worker/targets.js` 与 `worker/slot_formats.js`，两者都是纯数据（`pipeline/worker_targets.py`） |
| 被否掉 | 继续用 Python 生成 JS：策略分支无法被 `eslint` 与 Node 测试覆盖，改一行头逻辑也要动生成器（`CHANGELOG.md`） |
| 代价 | 生成边界要持续守护：测试断言生成模块不含 `function `，CI 对两个数据模块做 `git diff`；差分矩阵依赖 `git show HEAD:index.js`，旧入口消失后自动跳过，之后只剩行为测试（`tests/pipeline/test_pipeline.py`、`.github/workflows/ci.yml`、`tests/worker/source-equivalence.test.mjs`） |

## ADR-4 目录归位：`oriImg` → `assets/original`，`public` 拆分，`out` → `dist`

| 项 | 内容 |
| :--- | :--- |
| 背景 | 源图、手写静态文件与 1GB 生成池混在源码树里：生成物既可能被当成源码提交，也可能被构建工具当输入扫描（`CHANGELOG.md`） |
| 决定 | 源图进 `assets/original/`；手写静态进 `assets/static/`（Vite `publicDir`）；生成池进 `assets/generated/`，仅 `counts.json` 入库；产物目录统一为 `dist/`（`.gitignore`、`vite.config.ts`、`wrangler.jsonc`） |
| 被否掉 | 保留 `public/` 混放（即归位前的形态）：`publicDir` 会把生成池当手写资源，1GB 文件与 `.gitignore` 规则无法共存（`CHANGELOG.md`、`vite.config.ts`） |
| 代价 | 运行时 URL 必须与目录解耦：`/counts.json`、`/<category>/<hex>.<ext>` 都是平铺的，`generated/` 段永远不出现在请求路径里，因此 dev 必须靠自定义中间件复刻同一套 URL（`vite.config.ts`、`CHANGELOG.md`） |

## ADR-5 单后缀 + 运行时 `Content-Type` 覆盖

| 项 | 内容 |
| :--- | :--- |
| 背景 | 槽位后缀由 `ext_policy` 决定，而源文件可能是 PNG/WebP；池按字节原样拷贝，于是 `a` 里的 PNG 被拷进 `.jpeg` 槽位。平台按后缀推导 `Content-Type`，后缀因此变成一句谎话（`pipeline/catalog.py`、`pipeline/formats.py`、`README.md`） |
| 决定 | 每个分类保持单一后缀（`h`/`v` → `.jpg`、`a` → `.jpeg`、`gif` → `.gif`、未知分类 → 首个源文件后缀），同时给每个槽位记录真实格式码写入 `worker/slot_formats.js`，由 Worker 在响应时覆写 `Content-Type`（`pipeline/formats.py`、`pipeline/worker_targets.py`、`worker/index.js`） |
| 被否掉 A | 逐槽位后缀（每个文件用自己的真实后缀）：边缘重写表达式无法按槽位挑后缀，只能拼一个固定后缀，否则规则要改成 `/pic?img=<category>`；而且会改动 234 个槽位的 URL（`a` 125 + `h` 81 + `v` 28，`SLOT_MISMATCH_BASELINE`）（`docs/reference/transform-rules.md`、`tests/pipeline/test_pipeline.py`） |
| 被否掉 B | 源图转码成后缀对应的格式：`assets/original/a/` 下 24 个 PNG 的 IHDR 颜色类型实测全为 6（RGBA），转 JPEG 会丢透明通道；同时全部槽位字节与 URL 一起变（`assets/original/a/`、`README.md`） |
| 代价 | 磁盘上的后缀与字节长期不一致，`--strict-formats` 对真实池必然失败，只能作为"漂移不再增长"的闸门；MIME 纠正依赖 `run_worker_first: true`，绕过 Worker 的路径（Pages 适配器）会退回错误类型；`slot_formats.js` 必须与池同批生成（`pipeline/README.md`、`wrangler.jsonc`、`worker/index.js`） |

`ext_policy: "source"` 不是这个问题的解：它只取第一个有效源文件的后缀套给整个分类，只有当分类本身后缀同质时才消除漂移（`gif` 是），混分类上只是把漂移换个方向，代价是所有槽位换 URL 并重生成池（`pipeline/catalog.py`、`pipeline/README.md`）。

## ADR-6 规则层用 `eq` 精确匹配，不用扩展名终止条件

| 项 | 内容 |
| :--- | :--- |
| 背景 | 早期重写规则用 `starts_with(path, "/a")` 判分类、用 `not ends_with(path, ".jpg")` 终止（`docs/reference/transform-rules.md`） |
| 决定 | 匹配 `http.request.uri.path eq "/<category>"`，重写为 `concat("/<category>/", substring(uuidv4(cf.random_seed), 0, 2), "<ext>")`；并把 Vite 产物目录从 `/assets` 改到 `/static`（`vite.config.ts`、`docs/reference/transform-rules.md`） |
| 被否掉 A | 扩展名终止：一旦分类用 `.gif`/`.jpeg`，重写结果不再以 `.jpg` 结尾，规则会二次触发，把 `/gif/0a.gif` 变成 `/gif/0a.gif/3f.jpg`；这等于强迫所有分类共用一个后缀（`docs/reference/transform-rules.md`） |
| 被否掉 B | `starts_with` 前缀匹配：`/a` 同时命中 `/api/pic`，也曾命中过当时的 `/assets/main-*.js`，把站点 bundle 重写成 `.js/3f.jpeg` 而 404（真实故障，`docs/reference/transform-rules.md`） |
| 被否掉 C | `matches` 正则：需要 Business / WAF Advanced，免费版直接报 `not entitled`（`docs/reference/transform-rules.md`） |
| 代价 | 每个分类一条规则；`substring` 长度必须等于 `--hash-length`，后缀必须等于该分类的 `ext_policy`，两者都靠人工同步，改策略时要同时改规则并重生成池（`docs/reference/transform-rules.md`、`assets/catalog.json`） |

## 遗留问题

| 问题 | 现状 | 出处 |
| :--- | :--- | :--- |
| `h`/`v` 是否切到 `ext_policy: "source"` | 明确标为 `TODO(P3)`，切换意味着换 URL 并重生成池 | `pipeline/catalog.py` |
| 逐槽位后缀 | 已否掉；若将来采用，规则层需改为 `/pic?img=<category>`，每请求多一次 Worker 调用 | `docs/reference/transform-rules.md` |
| Pages 路径的 MIME | 适配器只有 `/pic` 语义，没有资产分支，因此不做纠正 | `worker/pages.js`、`pipeline/README.md` |
| 旧入口差分矩阵 | `git show HEAD:index.js` 不存在时用例自动跳过，长期只剩行为测试 | `tests/worker/source-equivalence.test.mjs` |
| 真实池的字节漂移基线 | `a` 56/114、`h` 43/138、`v` 7/67 源文件不一致；`a` 125、`h` 81、`v` 28 槽位不一致，只允许下降 | `tests/pipeline/test_pipeline.py` |
