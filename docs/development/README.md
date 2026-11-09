# 开发分册导读

本分册覆盖"本地跑起来 → 改完自验 → 提交 / CI / 发布"这条闭环。结构与取舍不在这里讲：分层见 [../architecture/layers.md](../architecture/layers.md)，构建期契约见 [../architecture/build-pipeline.md](../architecture/build-pipeline.md)。

## 环境清单

| 依赖 | 要求 | 出处 |
| --- | --- | --- |
| Node.js | `>= 22`；CI 固定 `22` | `package.json`（`engines`）、`.github/workflows/ci.yml` |
| Python | `3.8+`；CI 固定 `3.12` | `CONTRIBUTING.md`、`.github/workflows/ci.yml` |
| npm | 随 Node；安装用 `npm ci --ignore-scripts` | `CONTRIBUTING.md`、`.github/workflows/deploy.yml` |
| Wrangler | 已在 `devDependencies` 锁定 `^4.54.0`，不必全局安装 | `package.json` |
| Git | 需要能从 `HEAD` 取到历史文件（差分矩阵） | `tests/worker/source-equivalence.test.mjs` |
| 磁盘 | `assets/original/` 约 240 MB；真拷贝后 `assets/generated/` 约 1 GB | `du -sh assets/*` 实测；`vite.config.ts` 注释按 1 GB 量级估算 |

Wrangler 只有需要在本机跑 Workers 运行时（`wrangler dev`）时才用；纯前端开发不需要它（`vite.config.ts`、`package.json`）。

## 最短上手路径

```bash
npm ci --ignore-scripts                        # 按 lockfile 装依赖，跳过生命周期脚本（CONTRIBUTING.md）
python -m pipeline --no-copy --hash-length 2   # 只写元数据与占位图，秒级完成（CONTRIBUTING.md）
npm run dev                                    # Vite dev server（package.json）
```

三条本地验证路径，按要改的层选一条：

| 要验的东西 | 命令 | 说明 |
| --- | --- | --- |
| 页面、样式、交互 | `npm run dev` | dev 中间件直接从 `assets/generated/` 服出 `/counts.json` 与 `/<cat>/<hex>.<ext>`（`vite.config.ts`） |
| 生产构建产物 | `npm run build` → `npm run preview` | 先写 `dist/`，再由 `vite preview` 静态托管（`package.json`） |
| Worker 重定向与访问策略 | `npm run build` → `npx wrangler dev --local` | dev server 不执行 Worker；本地绑定放在 `.dev.vars`（`.dev.vars.example`） |

## 文件列表

| 文件 | 回答什么问题 |
| --- | --- |
| [build.md](build.md) | 每个 npm 脚本真实做什么？`dist/` 怎么装配出来？Windows 上有哪些坑？ |
| [code-style.md](code-style.md) | TypeScript / React / Python / Worker JS 各写在哪一层、遵守哪些约定？ |
| [testing.md](testing.md) | 四套测试各管什么边界？基线门禁怎么读？新增一个测试要动哪里？ |
| [workflow.md](workflow.md) | 提交信息、PR 检查清单、CI 步骤顺序与发布流程 |

## 需要时才会用到的两件事

| 场景 | 做法 | 出处 |
| --- | --- | --- |
| 本地跑 Worker 并读环境变量 | 复制 `.dev.vars.example` 为 `.dev.vars`，按需改 `REFERER_*` / `CORS_*` / `PROTECT_ASSET_IMAGES` | `.dev.vars.example`、`.gitignore` |
| 想知道清单字段含义 | 读 `assets/generated/counts.json` 的字段说明，不要从代码猜 | [../reference/generated-files.md](../reference/generated-files.md) |

`.dev.vars` 被忽略，不会入库；真实允许名单只存在于线上 secret（`.gitignore`、`.dev.vars.example`）。

## 阅读顺序

1. 本页 → [build.md](build.md)：先能跑、能构建。
2. [code-style.md](code-style.md)：动手前对齐书写约定，避免把生成物当源码改。
3. [testing.md](testing.md)：改完跑哪几套、失败了看哪条断言。
4. [workflow.md](workflow.md)：提交前对着 PR 清单自检。

需要字段级细节时跳出去：`counts.json` 字段见 [../reference/generated-files.md](../reference/generated-files.md)，环境变量见 [../reference/configuration.md](../reference/configuration.md)。

## 三条不要打破的规矩

| 规矩 | 原因 | 出处 |
| --- | --- | --- |
| 生成物不手改：`worker/targets.js`、`worker/slot_formats.js`、`assets/generated/counts.json` 由管线重写 | 每次 `python -m pipeline` 覆盖，CI 还会 diff 三者 | `pipeline/__init__.py`、`.github/workflows/ci.yml` |
| 不要在仓库根跑 `python -m pipeline --no-copy` | 会把 1 GB 真实图片池替换成 1×1 占位字节，必须重跑真拷贝才能恢复 | [build.md](build.md)、`pipeline/placeholders.py` |
| 不在 PR 里悄悄加依赖 | CI 用 `npm ci` 按 lockfile 复现完全一致的版本；新依赖要先在描述里说明 | `.gitignore`（注释）、`.github/workflows/deploy.yml`、`CONTRIBUTING.md` |
