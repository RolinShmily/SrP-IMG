# 架构分册

本分册只解释"骨架为什么长这样"：仓库把图片池拆成数据层、构建层、运行时、展示层四段，每段有唯一的写者，跨层只通过文件契约通信（`pipeline/README.md`）。
构建期决定槽位顺序、文件名与 JSON 字节，运行时只消费这些结果而不做二次加工，所以任何"顺手整理格式或换一种排序"的改动都会改变线上 URL（`pipeline/pool.py`、`pipeline/manifest.py`）。
三种访问入口（`/pic`、`/<category>/<hex>.<ext>`、边缘重写的 `/<category>`）最终都落到同一个资产并经过同一个 Worker，因此访问策略与 `Content-Type` 纠正只有一处实现（`worker/index.js`、`wrangler.jsonc`）。

## 四层总图

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
            │              worker/index.js + worker/policy.js
            │                       │ env + ASSETS binding
            ▼                       ▼
      vite build ───────────► dist/ ──► wrangler deploy
            │
            └──► src/ 只 fetch /counts.json 与槽位 URL
```

`dist/` 只是静态资产目录；Worker 代码由 wrangler 从 `wrangler.jsonc` 的 `main` 单独打包，两者在构建期不相交（`wrangler.jsonc`、`vite.config.ts`）。

## 文件列表

| 文件 | 回答的问题 |
| :--- | :--- |
| [layers.md](layers.md) | 四层边界、所有权矩阵、依赖方向、每层允许与禁止 |
| [build-pipeline.md](build-pipeline.md) | 构建期各阶段的顺序，哪些顺序与格式是字节契约 |
| [runtime.md](runtime.md) | Worker 内部：三种入口、策略引擎、资产保护、`Content-Type` 纠正 |
| [data-flows.md](data-flows.md) | 五条主链路的参与者与编号步骤 |
| [decisions.md](decisions.md) | 已做的取舍、被否掉的方案、代价与遗留问题 |

## 建议阅读顺序

| 目的 | 顺序 |
| :--- | :--- |
| 第一次理解仓库 | 本页 → [layers.md](layers.md) → [data-flows.md](data-flows.md) |
| 改 Pipeline 或生成物 | [build-pipeline.md](build-pipeline.md) → [decisions.md](decisions.md) → [reference/generated-files.md](../reference/generated-files.md) |
| 改 Worker 或排查响应头 | [runtime.md](runtime.md) → [reference/api.md](../reference/api.md) |
| 配置边缘重写 | [runtime.md](runtime.md) → [reference/transform-rules.md](../reference/transform-rules.md) |
| 做 code review | [layers.md](layers.md) 的允许/禁止表 → [decisions.md](decisions.md) 的代价段 |

## 与其他分册的分工

| 不在本册 | 去哪 |
| :--- | :--- |
| 颜色、组件、动效、双语 | [design/README.md](../design/README.md) |
| 本地命令、测试套件、提交与发布 | [development/README.md](../development/README.md) |
| 接口字段、环境变量、生成物清单、规则层配置 | [reference/README.md](../reference/README.md) |

## 本分册的三条硬约束

1. **`pipeline/` 是生成数据的唯一生产者**：`assets/generated/`、`worker/targets.js`、`worker/slot_formats.js` 只能由 `python -m pipeline` 写出（`pipeline/README.md`）。
2. **`src/` 与 `worker/` 互不 import**：唯一共享面是 URL 形状与 `counts.json` 的字段（`worker/targets.js`、`contracts/manifest.schema.json`）。
3. **`dist/` 与 `assets/generated/` 的槽位文件不进版本库**：`.gitignore` 只放行 `assets/generated/counts.json`，CI 用 `git diff` 校验三个已入库的生成物（`.gitignore`、`.github/workflows/ci.yml`）。
