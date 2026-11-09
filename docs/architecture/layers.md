# 四层边界与所有权

仓库里每一个路径都能回答三个问题：谁写它、谁读它、是否入库。答不上来的路径通常意味着分层已经破了（`pipeline/README.md`）。

## 1. 分层

| 层 | 路径 | 职责 | 唯一写者 |
| :--- | :--- | :--- | :--- |
| 数据层 | `assets/original/`、`assets/catalog.json` | 源图与分类注册表，唯一的内容真相 | 人工 |
| 构建层 | `pipeline/` | 扫描、槽位生成、清单、Worker 数据模块 | `python -m pipeline` |
| 运行时 | `worker/`、`functions/pic.js` | 302 跳转、访问策略、资产保护、MIME 纠正 | 人工（数据模块除外） |
| 展示层 | `src/`、`index.html`、`gallery.html`、`settings.html`、`assets/static/` | Vite + React 多页应用与手写静态文件 | 人工 |
| 部署产物 | `dist/` | 上传给 Workers Assets 的目录 | `vite build` |

## 2. 所有权矩阵

| 路径 | 写者 | 读者 | 入库 |
| :--- | :--- | :--- | :--- |
| `assets/original/**` | 人工 | `pipeline/scan.py` | 是 |
| `assets/catalog.json` | 人工 | `pipeline/catalog.py`、文档 | 是 |
| `assets/static/**` | 人工 | Vite `publicDir` | 是 |
| `assets/generated/<category>/*` | `python -m pipeline` | Vite `closeBundle`、dev 中间件 | 否（`.gitignore`） |
| `assets/generated/counts.json` | `python -m pipeline` | `src/`（`/counts.json`）、`tests/`、CI diff | 是 |
| `worker/targets.js` | `python -m pipeline` | `worker/index.js`、`worker/policy.js` | 是 |
| `worker/slot_formats.js` | `python -m pipeline` | `worker/index.js`、`tests/` | 是 |
| `worker/index.js`、`worker/policy.js`、`worker/pages.js` | 人工 | wrangler（`main`）、Pages | 是 |
| `functions/pic.js` | 人工（re-export） | Pages Functions | 是 |
| `src/**`、三个 HTML、`vite.config.ts` | 人工 | `vite build` | 是 |
| `contracts/**` | 人工 | `pipeline/manifest.py` 校验、review | 是 |
| `dist/**` | `vite build` | `wrangler deploy` | 否（`.gitignore`） |

Worker 不直接读 `counts.json`：它读的是由清单派生的 `worker/targets.js` 与 `worker/slot_formats.js`（`pipeline/worker_targets.py`、`worker/index.js`）。

## 3. 依赖方向

```
数据层
  assets/original/**      assets/catalog.json
        │                        │
        └──────────┬─────────────┘
                   ▼  python -m pipeline（构建层）
        ┌────────────────────────────────────┐
        │ scan → pool → manifest → targets   │
        └───┬───────────────────────┬────────┘
            │                       │
            ▼                       ▼
  assets/generated/**        worker/targets.js
  counts.json + 槽位文件      worker/slot_formats.js
            │                       │
            │                       ▼ 运行时层
            │              worker/index.js ── worker/policy.js
            │                       │  env + ASSETS binding
            ▼                       ▼
      vite build ───────────► dist/ ──► wrangler deploy
            │
            └──► src/ 只 fetch /counts.json 与槽位 URL
```

箭头只有一个方向：下游可以读上游的产物，上游不得知道下游存在。`pipeline/` 不感知 Vite，`src/` 不感知 Worker 目录结构，`worker/` 不感知构建期——`worker/policy.js` 的头注释写明“hand-written source, not generated”，只有分类数据来自 `worker/targets.js`。

## 4. 每层允许与禁止

### 数据层

| 允许 | 禁止 |
| :--- | :--- |
| 增删 `assets/original/<category>/` 下的图片 | 手改 `assets/generated/`（构建产物，下次运行即被覆盖） |
| 改 `assets/catalog.json` 的 `label`/`name_zh`/`name_en`/`ext_policy` | 手工编辑 `counts.json`（`contracts/manifest.schema.json` 校验会失败） |
| 在每个分类放可选的 `meta.json` 覆盖展示名与比例（`pipeline/scan.py`） | 单文件超过 5MB（会被 `filter_valid_images` 跳过，只留一行计数日志，`pipeline/scan.py`） |

### 构建层

| 允许 | 禁止 |
| :--- | :--- |
| 写 `assets/generated/<category>/` 的直接子文件 | 写 `assets/static/`、`assets/original/`、`src/`、`dist/`、`wrangler.jsonc` |
| 写 `assets/generated/counts.json` | 写运行时逻辑（生成模块只允许数据，测试断言不含 `function `） |
| 写 `worker/targets.js`、`worker/slot_formats.js` | 删除 `assets/generated/<category>/` 下的嵌套目录（`clear_dir_files` 只删直接子文件） |

出处：`pipeline/README.md`、`pipeline/pool.py`、`tests/pipeline/test_pipeline.py`。

### 运行时

| 允许 | 禁止 |
| :--- | :--- |
| 读 `env`、`env.ASSETS`、`targets.js`、`slot_formats.js` | import `src/`、`pipeline/` 或任何构建期模块 |
| 按请求覆写 `Content-Type`、`Vary`、`Cache-Control` | 内嵌 hostname、allowlist 或部署专属字符串 |
| 把未匹配的路径原样交给 `env.ASSETS.fetch` | 读仓库文件系统，或依赖构建期才存在的目录结构 |

出处：`worker/index.js`、`worker/policy.js`、`tests/backend-contract.test.mjs`（断言源码不含 `srprolin` 与 `ACCESS_POLICY`）。

### 展示层

| 允许 | 禁止 |
| :--- | :--- |
| `fetch("/counts.json")`，按 `hash_length`/`category_exts`/`slot_ratios` 拼 URL | import `worker/`、`pipeline/`，或读 `assets/generated/` 的文件系统路径 |
| 用 `@/` 别名引用 `src/`（`vite.config.ts`） | 把分类清单硬编码进组件（`src/pages/gallery.tsx` 的 `DEFAULT_CATEGORIES` 只是加载失败时的兜底） |
| 引用 `/icon.svg`、`/fonts/*` 等 `assets/static` 文件 | 生成或改写 `counts.json` |

### 部署产物

| 允许 | 禁止 |
| :--- | :--- |
| `vite build` 全量重写（`emptyOutDir: true`） | 手工编辑 `dist/` 里的任何文件 |
| 由 `closeBundle` 把 `assets/generated/` 平铺拷入 | 入库 `dist/`，或在 `dist/` 里放构建脚本 |

## 5. 跨层共享面

| 共享面 | 内容 | 生产者 | 消费者 |
| :--- | :--- | :--- | :--- |
| `worker/targets.js` | `HASH_LENGTH`、`IMAGE_EXT`、`TARGETS`（URL 形状与槽位数） | `pipeline/worker_targets.py` | `worker/index.js`、`worker/policy.js` |
| `worker/slot_formats.js` | 每槽一个格式码 `j`/`p`/`g`/`w`/`?` | `pipeline/worker_targets.py` | `worker/index.js` |
| `assets/generated/counts.json` | 分类、计数、每槽比例、后缀 | `pipeline/manifest.py` | `src/`、`tests/` |
| `contracts/manifest.schema.json` | `counts.json` 的 JSON Schema | 人工 | `pipeline/manifest.py`、review |

## 6. 常见越界

| 症状 | 越界点 | 正确做法 |
| :--- | :--- | :--- |
| 改了分类名，`generated_at` 也变了 | 把标签塞进时间戳比较 | 六键比较只覆盖计数类字段（`pipeline/manifest.py`） |
| 本地图片 404、线上正常 | 在 `src/` 里拼了带 `generated/` 段的路径 | URL 一律平铺为 `/counts.json` 与 `/<category>/<hex><ext>`（`vite.config.ts`） |
| 部署后 MIME 又错了 | 关掉了 `run_worker_first` | 保持 `assets.run_worker_first: true`（`wrangler.jsonc`） |
| 新增分类要改前端 | 前端硬编码分类 | 让 `counts.json` 驱动（`src/pages/gallery.tsx`） |
