# 分支、CI 与发布

## 提交信息

遵循 Conventional Commits，前缀与现有历史一致，描述用中文（`CONTRIBUTING.md`、`CONTRIBUTING.zh.md`）：

| 前缀 | 用在 |
| --- | --- |
| `feat:` | 新增能力（分类、接口行为、页面模块） |
| `fix:` | 修缺陷（含 `Content-Type` 纠正、策略判定） |
| `docs:` | 只改文档 |
| `chore:` | 依赖、CI、仓库杂务 |
| `refactor:` | 不改行为的重构（含运行时从生成物改为手写） |

一个 PR 只做一件事；描述里写清"改了什么、为什么"（`CONTRIBUTING.md`）。生成物必须与代码同一次提交：改了 `pipeline/` 或 `worker/` 就一起提交 `worker/targets.js`、`worker/slot_formats.js`、`assets/generated/counts.json`（`CONTRIBUTING.md`、`.github/PULL_REQUEST_TEMPLATE.md`）。

## PR 检查清单

对齐 `.github/PULL_REQUEST_TEMPLATE.md` 的原始条目：

| 检查项 | 判定方式 | 出处 |
| --- | --- | --- |
| 已读贡献指南 | 人工 | `.github/PULL_REQUEST_TEMPLATE.md` |
| `npm run build` 本地通过 | 人工；CI 也会跑 | 同上、`.github/workflows/ci.yml` |
| 改了 `worker/` 或 `pipeline/` 则已提交三个生成物 | CI 用 `git diff --exit-code` 对三者做硬校验 | 同上、`.github/workflows/ci.yml` |
| 用户可见行为变化时**双语** README 都更新 | 人工（`README.md` 与 `README_zh.md`） | 同上 |
| 新增分类或图片放在 `assets/original/<category>/`，压到 **2 MB** 以下，且有权分发 | 人工；超过 **5 MB** 的源文件会被构建跳过 | 同上、`CONTRIBUTING.md` |
| 无密钥、token、Cloudflare 凭据 | 人工；部署值只放仓库 secret | 同上、`.github/workflows/deploy.yml` |
| `package-lock.json` 与 `package.json` 同步，新依赖在描述里说明 | 人工；CI 用 `npm ci` | 同上 |

模板里另有"变更类型"四选一（bug fix / new feature / documentation / build-CI-housekeeping），非强制校验项（`.github/PULL_REQUEST_TEMPLATE.md`）。

## CI 流程

触发条件：只在 `pull_request` 与手动 `workflow_dispatch` 上跑；推 `main` 由发布工作流处理，不重复构建（`.github/workflows/ci.yml` 头注释）。`contents: read` 权限，`concurrency` 按 ref 分组且 `cancel-in-progress: true`。

| 顺序 | 步骤 | 命令 / 动作 |
| --- | --- | --- |
| 1 | Checkout | `actions/checkout@v7` |
| 2 | Node | `actions/setup-node@v7`，`node-version: '22'`，`cache: npm` |
| 3 | Python | `actions/setup-python@v7`，`python-version: '3.12'` |
| 4 | 安装 | `npm ci --ignore-scripts` |
| 5 | Lint | `npm run lint` |
| 6 | 生成 | `python -m pipeline --no-copy --hash-length 2` |
| 7 | 生成物同步检查 | `git diff --exit-code -- worker/targets.js worker/slot_formats.js assets/generated/counts.json` |
| 8 | 构建 | `npm run build` |
| 9 | 测试 | `npm test` |
| 10 | 类型检查 | `npm run typecheck` |

两处容易误读：

- 第 7 步只 diff 三个生成文件，图片池本身被 git 忽略（`.gitignore`、`.github/workflows/ci.yml` 注释）；`--no-copy` 与真跑在这三个文件上逐字节一致，所以能在不拷贝 1 GB 的前提下判定"是否忘了重新生成"。
- 第 10 步才是类型门禁：第 8 步的 `vite build` 只转译不做类型检查（`.github/workflows/ci.yml` 注释）。

`npm test` 内部的差分矩阵会因为 `HEAD` 里没有 `index.js` 而自动 skip，属于预期行为，不是漏跑（[testing.md](testing.md)）。

## 发布流程

触发条件：推 `main`（忽略只改 `**.md` 与 `LICENSE` 的提交）或手动 `workflow_dispatch`。`concurrency` 为 `cancel-in-progress: false`，不允许两次部署并发抢同一个 Worker（`.github/workflows/deploy.yml`）。

| 顺序 | 步骤 | 命令 |
| --- | --- | --- |
| 1 | Checkout + Node 22 + Python 3.12 | 同 CI |
| 2 | 安装 | `npm ci --ignore-scripts` |
| 3 | 生成（**真拷贝**） | `python -m pipeline --hash-length 2` |
| 4 | 构建 | `npm run build` |
| 5 | 部署 | `npx wrangler deploy` |

与 CI 的三点差异：

| 差异 | CI | 发布 |
| --- | --- | --- |
| 生成方式 | `--no-copy` | 真拷贝，槽位里是真实图片字节 |
| Lint / 测试 / 类型检查 | 全跑 | 不跑（PR 阶段已完成） |
| 凭据 | 不需要 | `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 来自仓库 secret |

`npm run deploy` 等价于 `npx wrangler deploy`，上传的是 `wrangler.jsonc` 里 `assets.directory: "./dist"` 与 `main: "worker/index.js"`（`package.json`、`wrangler.jsonc`）。

## 环境变量与部署值

| 项 | 位置 | 出处 |
| --- | --- | --- |
| 访问策略 env（`REFERER_*`、`CORS_*`、`PROTECT_ASSET_IMAGES`） | 运行时 secret，用 `wrangler secret put` 或 Dashboard 配 | `.dev.vars.example`、`wrangler.jsonc` 注释 |
| `wrangler.jsonc` 的 `vars` | 刻意不存在（文件明文入库） | `wrangler.jsonc`、`tests/backend-contract.test.mjs` |
| 本地 `wrangler dev` 绑定 | 复制 `.dev.vars.example` 为 `.dev.vars`（被忽略） | `.dev.vars.example`、`.gitignore` |
| 部署凭据 | GitHub 仓库 secret | `.github/workflows/deploy.yml` |

失效模式是 fail closed：非法值返回 500，而不是放开限制（`.dev.vars.example` 注释、`tests/backend-contract.test.mjs`）。字段含义与默认值见 [../reference/configuration.md](../reference/configuration.md)。

## 部署后的缓存

`PROTECT_ASSET_IMAGES=1`（默认）时，Worker 对每个请求都重新判定策略，因此图片响应带 `Cache-Control: private, no-store`，边缘不缓存，部署后不存在"旧图被缓存"的问题（`../reference/transform-rules.md` 的"Known limits"）。关闭资产保护后静态资产回到 CDN 缓存策略，是否需要主动刷新缓存属于运维动作，仓库内没有对应的脚本或工作流，**待确认**。

## 发布前自检（本地最短路径）

```bash
npm run build          # dist/ 能装配出来（package.json）
npm test               # 四套测试（package.json）
npm run typecheck      # 类型门禁（package.json）
git status --short     # 三个生成物是否已一并提交（.github/workflows/ci.yml）
```
