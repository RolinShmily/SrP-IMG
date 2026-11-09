# 命令与构建顺序

每个 npm 脚本都是一行命令，没有隐藏步骤；`scripts` 全表见 `package.json`。构建期的数据契约（扫描 → 槽位 → 清单 → 数据模块）见 [../architecture/build-pipeline.md](../architecture/build-pipeline.md)。

## 命令表

| 命令 | 实际执行 | 产物 / 副作用 | 出处 |
| --- | --- | --- | --- |
| `npm run gen` | `python -m pipeline --hash-length 2` | 写 `assets/generated/<cat>/<hex>.<ext>`、`assets/generated/counts.json`、`worker/targets.js`、`worker/slot_formats.js` | `package.json`、`pipeline/__init__.py` |
| `npm run build` | `vite build` | 清空并重写 `dist/`（三个 HTML 入口 + 资源 + 图片池） | `package.json`、`vite.config.ts` |
| `npm run build:all` | `npm run gen && npm run build` | 先补数据，再打包 | `package.json` |
| `npm run dev` | `vite` | 起 dev server，不产出 `dist/` | `package.json` |
| `npm run preview` | `vite preview` | 静态托管已有 `dist/`（`npm start` 等价） | `package.json` |
| `npm test` | 两套 Python 测试 + `node --test` 两套 JS 测试 | 只读，不改仓库；详见 [testing.md](testing.md) | `package.json` |
| `npm run lint` | `eslint .`（flat config） | 只报错，不修复 | `package.json`、`eslint.config.mjs` |
| `npm run typecheck` | `tsc --noEmit` | 真正的类型门禁，`vite build` 不做类型检查 | `package.json`、`tsconfig.json` |
| `npm run deploy` | `wrangler deploy` | 上传 `dist/` 与 `worker/index.js` 到线上 | `package.json`、`wrangler.jsonc` |

补充事实：`npm run build` 不运行管线，缺数据会直接失败（见下文 build 插件）；`npm run deploy` 也不运行管线，所以发布前必须先 `gen`（`.github/workflows/deploy.yml` 的顺序正是如此）。

## 构建顺序

```text
assets/original/<cat>/*           源图（240 MB 量级，已入库）
   │  npm run gen （python -m pipeline --hash-length 2）
   ▼
assets/generated/<cat>/<hex>.<ext>  槽位文件（真拷贝或 1×1 占位）
assets/generated/counts.json        清单（唯一被 git 跟踪的生成物）
worker/targets.js                   分类数据模块（无逻辑）
worker/slot_formats.js              每槽真实格式码
   │  npm run build （vite build）
   ▼
dist/  = 三个 HTML 入口 + JS/CSS + assets/static 原样拷贝 + 图片池拷贝
   │  npm run deploy （wrangler deploy）
   ▼
线上：worker/index.js + dist/（wrangler.jsonc 的 assets.directory）
```

哈希长度决定槽位数：`--hash-length 2` → 每分类 256 个槽（`16 ** 2`，`pipeline/config.py` 的 `num_slots`），文件名是两位十六进制。

## `vite.config.ts` 的两个插件

图片池故意不进 `publicDir`（它被 git 忽略且体积在 1 GB 量级），所以 dev 与 build 各插一个插件把它接到根路径上（`vite.config.ts` 注释）。

| 插件 | 生效阶段 | 职责 |
| --- | --- | --- |
| `srp:generated-assets-dev` | `apply: "serve"` | 在 Vite 自有中间件之前挂一层 `use()`，把 `/counts.json` 与 `/<cat>/<hex>.<ext>` 直接从 `assets/generated/` 读出发出 |
| `srp:generated-assets-build` | `apply: "build"` | `closeBundle` 阶段把 `assets/generated/` 的每个分类目录递归拷进 `dist/`，`counts.json` 单文件拷贝 |

dev 中间件的判定与细节（`vite.config.ts`）：

| 项 | 行为 |
| --- | --- |
| 匹配范围 | 单段且为 `counts.json`；或两段且文件名为 `/^[0-9a-f]+\.(jpe?g|png|gif|webp|avif)$/` |
| 路径安全 | 解析后必须 `startsWith(generatedDir + path.sep)`，否则交回 `next()` |
| 缓存头 | `counts.json` 带 `Cache-Control: no-cache`；槽位文件只设 `Content-Type` 与 `Content-Length` |
| `HEAD` | 只发头，`res.end()` 不读文件 |
| 未命中 | 文件不存在或不是普通文件时交回 `next()`，走常规静态/SPA 回退 |

build 插件的失败方式：`assets/generated/` 不存在时直接抛错，提示先跑 `npm run gen`；存在时按目录串行拷贝（不并发上千次读取，`vite.config.ts` 注释说明这是为了让 Windows 上的构建保持诚实）。

## `assets/static` 与 `dist/` 装配

| 内容 | 来源 | 结果 |
| --- | --- | --- |
| HTML 入口 | `index.html`、`gallery.html`、`settings.html`（`rollupOptions.input`） | `dist/index.html`、`dist/gallery.html`、`dist/settings.html` |
| 手写静态文件 | `publicDir = assets/static`（`_headers`、`fonts/`、`icon.svg`、`placeholder.svg`） | 原样出现在 `dist/` 根下 |
| 图片池 | `assets/generated/` | `dist/h/`、`dist/v/`、`dist/a/`、`dist/gif/`、`dist/counts.json` |
| 清空策略 | `emptyOutDir: true` | 每次构建删掉旧 `dist/`，不要往里放手工文件 |

`dist/` 与 `assets/generated/*`（除 `counts.json`）都被忽略，不入库（`.gitignore`）。

## Windows 注意点

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 重建时报 `dist/` 被占用 / `EPERM` | `wrangler dev` 会持有 `dist/` 目录 | 先停 Wrangler 进程，再 `npm run build` |
| 构建后本地 Worker 行为突变 | `emptyOutDir: true` 会把 `dist/` 整体删掉重建 | 构建完重新 `npx wrangler dev --local` |
| 行尾或空白差异污染 diff | CRLF 与尾随空格 | `.gitattributes` 统一 `eol=lf`，`.editorconfig` 规定 `trim_trailing_whitespace` |

## 危险操作

| 不要做 | 后果 |
| --- | --- |
| 在仓库根直接跑 `python -m pipeline --no-copy` | `assets/generated/` 里的真实图片被 1×1 占位字节（`TINY_JPEG` / `TINY_GIF`）覆盖，`dist/` 随之变成占位图；必须重跑不带 `--no-copy` 的 gen 才能恢复（`pipeline/placeholders.py`、`tests/pipeline/test_pipeline.py`） |
| 手改 `worker/targets.js`、`worker/slot_formats.js`、`assets/generated/counts.json` | 下次 gen 覆盖；CI 会 diff 三者并失败（`.github/workflows/ci.yml`） |
| 把图片池放进 `assets/static/` | 会被当成手写静态文件提交入库（`vite.config.ts`、`.gitignore`） |
| 用 `npm run preview` 验 Worker 行为 | `vite preview` 不执行 `worker/index.js`（`package.json`） |

`--no-copy` 的唯一正确用途是需要"元数据正确、字节不重要"的场合：CI 与测试的临时目录正是这类场景，见 [testing.md](testing.md)。
