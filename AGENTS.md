# 维护钩子

| 触发 | 同步动作 |
| --- | --- |
| 功能新增 / 行为变更 | 更新双语 README 三模块；按领域更新 `docs/architecture.md` 或 `docs/design.md`；补 `tests/` 对应样例 |
| CLI / 参数 / API / JSON Schema / 运行时配置变更 | 更新 `docs/reference.md`；补 `tests/backend-contract.test.mjs` 或 `tests/test_access_policy.py`；改动 `--hash-length`、`--ext`、`ext_policy` 或 `assets/catalog.json` 时同步 Transform Rules 并重建图片池 |
| 构建 / 测试流程变更 | 更新 `docs/development.md` 的命令、测试矩阵与 workflow 说明 |
| 依赖 / 第三方代码 / 资源变更 | 更新 `THIRD_PARTY_NOTICES.md`（仓库内自带的字体、素材与第三方代码）；npm 依赖随 `package-lock.json` 锁定 |
| 源图 / 分类 / 生成管线 / Worker 数据模块变更 | 重跑 `npm run gen`，提交 `assets/generated/counts.json`、`worker/targets.js`、`worker/slot_formats.js`；`tests/pipeline/test_pipeline.py` 漂移基线只降不增 |
| 界面 / 文案 / 主题变更 | 更新 `docs/design.md`；必要时重拍 `assets/screenshots/`（双语 README 引用） |
| workflow 新增 / 触发 / 步骤变更 | 更新 `docs/development.md` §4；workflow 地图：`test.yml`（PR、手动）、`deploy.yml`（push `main`、手动） |
| `tests/` 结构或样例变更 | 更新 `package.json` 的 `test` 脚本、`test.yml` 与 `docs/development.md` 的测试矩阵 |
| 根目录入口文件 / 目录或资产位置变更 | 更新双语 README、`docs/architecture.md` 所有权矩阵、workflow 路径与本文件 |

## 备注

- 不维护 `CHANGELOG.md` / GitHub Release：无 tag 版本化，`push main` 由 `.github/workflows/deploy.yml` 直接部署。
