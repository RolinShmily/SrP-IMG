# 构建期：从源图到数据模块

`python -m pipeline` 一次运行只做四件事，顺序固定：扫描 → 槽位 → 清单 → 数据模块（`pipeline/cli.py`）。阶段之间靠返回值传递，没有任何阶段回头读上一阶段的磁盘结果，所以"换一种执行顺序"不是重构而是改变产物。

## 0. 入口与顺序

```
Config.from_args(argv)                      # pipeline/config.py
└─（--strict-formats 时）audit_source_formats   # 只扫头部，零写入
   └─ materialize_all                       # 写 assets/generated/<category>/
      └─ build_manifest + write_manifest    # 写 assets/generated/counts.json
         └─ write_targets                   # 写 worker/targets.js → worker/slot_formats.js
```

默认值全部集中在 `pipeline/config.py`：`DEFAULT_HASH_LENGTH = 2`、`DEFAULT_EXT = ".jpg"`、`SIZE_LIMIT_MB = 5.0`、`SOURCE_DIR = assets/original`、`OUTPUT_DIR = assets/generated`、`WORKER_TARGETS = worker/targets.js`、`ALLOWED_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.webp')`。`catalog_path` 与 `schema_path` 锚定在包位置而不是 cwd，因此可以在任意目录运行（`pipeline/config.py`）。

## 1. scan：谁参与、以什么顺序

| 步骤 | 行为 | 出处 |
| :--- | :--- | :--- |
| 列目录 | `sorted()` 作用于 `Path` 对象，Windows 上按大小写折叠的名字键比较 | `pipeline/scan.py` |
| 过滤文件 | 后缀小写后必须落在 `ALLOWED_EXTENSIONS` 内，再 `sorted()` | `pipeline/scan.py` |
| 体积熔断 | 单文件 `<= 5.0MB` 才保留，超过的计数一次并打印一行 | `pipeline/scan.py` |
| 分类元数据 | `assets/original/<category>/meta.json` 可覆盖 `name_zh`/`name_en`/`aspect`/`aspect_hint`，格式错就静默忽略 | `pipeline/scan.py` |

排序不是风格问题：槽位 `i` 取循环序列的第 `i` 个元素，换排序就等于换"每个槽位放哪张图"，线上 URL 的内容随之改变（`pipeline/scan.py`、`pipeline/pool.py`）。

## 2. pool：槽位如何生成

| 决策 | 规则 | 出处 |
| :--- | :--- | :--- |
| 分类后缀 | `ext_policy: "default"` → `--ext`；`"source"` → 第一个有效源文件的后缀；`.suffix` → 字面值 | `pipeline/catalog.py`、`pipeline/pool.py` |
| 清理旧槽位 | 只删 `assets/generated/<category>/` 的直接子文件，嵌套目录保留 | `pipeline/pool.py` |
| 空分类 | 目录会被创建并清空旧槽位，但不写任何槽位文件；结果为 `slots = 0`、`aspect = None`、`aspect_hint = "暂无素材"` | `pipeline/pool.py` |
| 槽位映射 | `cycle(valid_images)`，槽位 `i` ↔ 第 `i mod len(valid_images)` 个源文件 | `pipeline/pool.py` |
| 槽位文件名 | `f"{i:0{hash_length}x}{cat_ext}"`，小写十六进制、左补零 | `pipeline/pool.py` |
| 字节写入 | 默认 `shutil.copy2` 原样拷贝；`--no-copy` 写 1×1 占位字节 | `pipeline/pool.py` |
| 比例 | 每槽 `round(w/h, 4)`；尺寸读不出时退回 `4/3` | `pipeline/pool.py` |
| 格式码 | 每槽一个 `j`/`p`/`g`/`w`/`?`，按槽位顺序追加 | `pipeline/formats.py`、`pipeline/pool.py` |

尺寸与格式码对每个源文件只读一次并缓存，循环里只重复结果，因此 `slot_formats[i]` 永远描述槽位 `i` 的真实字节（`pipeline/pool.py`）。

## 3. manifest：跨层契约

`assets/generated/counts.json` 的键序由字典字面量固定：`categories`、`counts`、`real_counts`、`category_exts`、`category_aspects`、`slot_ratios`、`hash_length`、`output_ext`、`generated_at`（`pipeline/manifest.py`）。`counts` 是槽位数，`real_counts` 是有效源文件数，两者不可互换（`pipeline/manifest.py`、`contracts/manifest.schema.json`）。

`generated_at` 只在**六个键**全部相同时沿用旧值：`counts`、`real_counts`、`category_exts`、`slot_ratios`、`hash_length`、`output_ext`（`pipeline/manifest.py`）。改标签或 `aspect_hint` 不会刷新时间戳；这条规则让"只改文案"的提交不产生无意义的清单 diff（`pipeline/manifest.py` 的行内注释）。

写盘前先按 `contracts/manifest.schema.json` 校验，校验器只实现该 schema 用到的子集（`type`/`enum`/`pattern`/`minimum`/`maximum`/`items`/`required`/`additionalProperties`），失败抛 `ManifestError`（`pipeline/manifest.py`）。

## 4. targets 与 slot_formats

两个模块一起写出，`worker/targets.js` 先、`worker/slot_formats.js` 后；半更新的配对会让每个请求都拿到错误的 MIME（`pipeline/worker_targets.py`）。

| 模块 | 内容 |
| :--- | :--- |
| `worker/targets.js` | 固定头注释、`export const HASH_LENGTH = <n>;`、`export const IMAGE_EXT = "<ext>";`、`export const TARGETS = JSON.parse("<转义后的 JSON>");` |
| `worker/slot_formats.js` | `export const SLOT_FORMATS = JSON.parse("<转义后的 JSON>");`，每分类一个字符串，一字符一槽位 |

分类键一律 `sorted(counts)`；`TARGETS[cat]` 的字段是 `dir`/`slots`/`ext`/`label`；没有对应结果的分类在 `SLOT_FORMATS` 里是空字符串（`pipeline/worker_targets.py`）。

## 5. 字节契约

| 契约 | 具体形态 | 出处 |
| :--- | :--- | :--- |
| 扫描顺序 | `sorted()` 直接作用于 `Path`，不是 `str` | `pipeline/scan.py` |
| `cycle` 映射 | 槽位 `i` 与源文件 `i mod n` 一一对应 | `pipeline/pool.py` |
| 清单键序 | 九个顶层键的书写顺序 | `pipeline/manifest.py` |
| `generated_at` | 只比较上述六个键 | `pipeline/manifest.py` |
| JSON 字节 | `json.dump(..., ensure_ascii=False, indent=2)`，`newline='\n'`，文件末尾无尾随换行 | `pipeline/manifest.py`、`assets/generated/counts.json` |
| 模块字节 | 固定头注释 + LF 结尾，`TARGETS`/`SLOT_FORMATS` 走 `JSON.parse` 双重转义 | `pipeline/worker_targets.py` |
| 占位字节 | `TINY_JPEG`/`TINY_GIF`/`TINY_PNG` 常量逐字节固定；`.webp` 等未列出的后缀落到 `else` 分支写 `TINY_JPEG` | `pipeline/placeholders.py`、`pipeline/pool.py` |

双重转义的理由是让生成文件保持"纯数据"：`json.dumps(json.dumps(targets, ensure_ascii=True))` 产出一个字符串字面量，运行时 `JSON.parse` 还原，生成器永远不需要拼接可执行逻辑（`pipeline/worker_targets.py`）。

## 6. `--no-copy` 与真实拷贝

| 维度 | 真实拷贝（默认） | `--no-copy` |
| :--- | :--- | :--- |
| 文件名 | 相同 | 相同 |
| 文件字节 | 源文件原样（`shutil.copy2`，含元数据） | 1×1 占位图 |
| 槽位数、比例、清单 | 相同 | 相同 |
| `slot_formats.js` | 由源文件头部决定 | 相同（不读槽位字节） |
| 体积 | 与源池同量级（当前 `assets/generated/` 约 1.1GB） | 可忽略 |

CI 用 `--no-copy` 跑生成并 `git diff --exit-code` 比较三个已入库产物，因为格式码来自源文件头部，`--no-copy` 与完整运行的结果应当一致（`.github/workflows/ci.yml`）。本地误用 `--no-copy` 会把槽位文件换成占位图，而 `assets/generated/` 被 gitignore，只能重跑完整生成恢复（`.gitignore`、`pipeline/placeholders.py`）。

## 7. `--strict-formats`：零写入前置闸门

| 条件 | 行为 | 出处 |
| :--- | :--- | :--- |
| 开关打开且 `assets/original` 存在 | 先跑 `audit_source_formats`，只读 12 字节头部，不建目录、不碰槽位 | `pipeline/cli.py`、`pipeline/pool.py` |
| 存在不匹配分类 | 逐条打印 `FormatReport.warning(copied=...)`，然后 `SystemExit(1)` | `pipeline/cli.py` |
| 全部匹配 | 继续正常流程，行为与不加开关一致 | `pipeline/cli.py` |
| 源目录根本不存在 | 跳过审计，交给 `materialize_all` 走原有的空运行诊断 | `pipeline/cli.py` |

零写入由测试固定：混入一个 PNG 后运行 `--strict-formats`，`assets/generated/` 与 `worker/` 都必须不存在（`tests/pipeline/test_pipeline.py` 的 `test_strict_formats_aborts_before_writing_anything`）。

## 8. 空输入与幂等

| 场景 | 结果 | 出处 |
| :--- | :--- | :--- |
| 没有 `assets/original`，或没有任何子目录 | 不写任何文件（连 `worker/` 都不建） | `pipeline/cli.py`、`tests/pipeline/test_pipeline.py` |
| 有分类目录但没有有效图片 | 写清单，该分类 `slots: 0`、`slot_formats` 为空串 | `pipeline/pool.py`、`tests/pipeline/test_pipeline.py` |
| 源文件没变 | 重跑后 `counts.json`、`targets.js`、`slot_formats.js` 逐字节相同 | `pipeline/manifest.py`、`tests/pipeline/test_pipeline.py` |

`tests/pipeline/test_pipeline.py` 用 `render_targets(Config(), metadata)` 重新推导 `worker/targets.js` 并要求逐字节相等，`worker/slot_formats.js` 同样从源树重建比对；CI 再对三个文件做一次 diff（`tests/pipeline/test_pipeline.py`、`.github/workflows/ci.yml`）。
