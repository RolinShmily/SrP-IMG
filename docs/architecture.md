# 架构说明

本文覆盖 imgroll 的四层边界与所有权、构建期管线、Worker 运行时、五条主链路以及关键架构取舍。

## 1. 四层边界与所有权

仓库里每个路径都有唯一写者与明确消费方：

| 层 | 路径 | 职责 | 唯一写者 |
| :--- | :--- | :--- | :--- |
| 数据层 | `assets/original/`、`assets/catalog.json` | 源图与分类注册表，唯一的内容真相 | 人工 |
| 构建层 | `pipeline/` | 扫描、槽位生成、清单、Worker 数据模块 | `python -m pipeline` |
| 运行时 | `worker/` | 302 跳转、访问策略、资产保护、MIME 纠正 | 人工（数据模块除外） |
| 展示层 | `src/`、`index.html`、`gallery.html`、`settings.html`、`assets/static/` | Vite + React 多页应用与手写静态文件 | 人工 |
| 部署产物 | `dist/` | 上传给 Workers Assets 的目录 | `vite build` |

### 所有权矩阵

| 路径 | 写者 | 读者 | 入库 |
| :--- | :--- | :--- | :--- |
| `assets/original/**` | 人工 | `pipeline/scan.py` | 是 |
| `assets/catalog.json` | 人工 | `pipeline/catalog.py`、文档 | 是 |
| `assets/manifest.schema.json` | 人工 | `pipeline/manifest.py` 校验 | 是 |
| `assets/static/**` | 人工 | Vite `publicDir` | 是 |
| `assets/screenshots/**` | 人工 | README 预览 | 是 |
| `assets/generated/<category>/*` | `python -m pipeline` | Vite `closeBundle`、dev 中间件 | 否（`.gitignore`） |
| `assets/generated/counts.json` | `python -m pipeline` | `src/`（`/counts.json`）、`tests/`、CI diff | 是 |
| `worker/targets.js` | `python -m pipeline` | `worker/index.js`、`worker/policy.js` | 是 |
| `worker/slot_formats.js` | `python -m pipeline` | `worker/index.js`、`tests/` | 是 |
| `worker/index.js`、`worker/policy.js` | 人工 | wrangler（`main`） | 是 |
| `src/**`、三个 HTML、`vite.config.ts` | 人工 | `vite build` | 是 |
| `dist/**` | `vite build` | `wrangler deploy` | 否（`.gitignore`） |

### 单向依赖方向

```text
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

下游只能消费上游产物，上游不感知下游：`pipeline/` 不感知 Vite，`src/` 不感知 Worker 目录结构，`worker/` 不直接读 `counts.json`（只读 `worker/targets.js` 与 `worker/slot_formats.js`），且源码中绝不内嵌任何部署域名或白名单。

### 各层红线

- **数据层**：允许增删源图、修改 `assets/catalog.json` 或放可选的 `assets/original/<cat>/meta.json`；禁止手改 `assets/generated/` 或 `counts.json`；单文件超过 **5 MB** 会被自动跳过。
- **构建层**：只写 `assets/generated/<cat>/` 的直接子文件（保留嵌套目录）、`counts.json`、`worker/targets.js`、`worker/slot_formats.js`；禁止触碰 `assets/static/`、`src/`、`dist/` 或生成可执行 JS 逻辑（测试断言不含 `function `）。
- **运行时**：只读 `env`、`env.ASSETS`、`targets.js`、`slot_formats.js`；禁止 import `src/` / `pipeline/` 或写死 hostname / allowlist。
- **展示层**：只 `fetch("/counts.json")` 并拼平铺 URL（`/<cat>/<hex><ext>`），不得出现 `generated/` 路径段；不得硬编码分类清单（`DEFAULT_CATEGORIES` 仅作加载失败兜底）。
- **部署产物**：`dist/` 每次由 `vite build` 全量清空重建，绝不手改或入库。

---

## 2. 构建管线（`pipeline/`）

`python -m pipeline` 顺序固定为：**扫描 → 槽位 → 清单 → 数据模块**（`pipeline/cli.py`）。阶段间通过内存对象传递，不回头读磁盘：

```text
Config.from_args(argv)                      # pipeline/config.py
└─（--strict-formats 时）audit_source_formats   # 只读 12 字节头部，零写入
   └─ materialize_all                       # 写 assets/generated/<category>/
      └─ build_manifest + write_manifest    # 校验并写 assets/generated/counts.json
         └─ write_targets                   # 写 worker/targets.js → worker/slot_formats.js
```

### 阶段规则与字节契约

1. **scan（`pipeline/scan.py`）**：目录与文件均按 `(p.name.lower(), p.name)` 排序，保证 Windows 与 Linux/macOS 的槽位归属一致（不可随意改排序）；扩展名过滤为 `('.jpg', '.jpeg', '.png', '.gif', '.webp')`；单文件 `<= 5.0 MB` 保留，超限打印忽略计数；支持可选 `meta.json` 覆盖展示名与宽高比。
2. **pool（`pipeline/pool.py`）**：
   - 后缀按 `assets/catalog.json` 的 `ext_policy` 解析（`"default"` → `--ext`；`"source"` → 首张有效源图后缀；字面 `.suffix` → 原样使用）。
   - 用 `itertools.cycle(valid_images)` 将源文件均匀扩散到 `16 ** hash_length` 个槽位（默认 `hash_length = 2` → 256 槽），文件名为 `f"{i:0{hash_length}x}{cat_ext}"`。
   - 默认 `shutil.copy2` 原样拷贝；`--no-copy` 写 `1×1` 占位字节（`TINY_JPEG` / `TINY_GIF` / `TINY_PNG`）。
   - 每个源文件只读一次头部获取宽高（`pipeline/image_size.py`）和真实格式码 `j/p/g/w/?`（`pipeline/formats.py`），生成 `slot_ratios`（缺失回落 `4/3`）和 `slot_formats`。
   - 空分类目录清空旧槽位但不写文件，结果记为 `slots = 0`、`aspect = None`、`aspect_hint = "暂无素材"`。
3. **manifest（`pipeline/manifest.py`）**：
   - 顶层 9 键顺序固定，写入前以 `assets/manifest.schema.json` 校验，失败抛 `ManifestError`。
   - `generated_at` 仅在六个内容键（`counts`、`real_counts`、`category_exts`、`slot_ratios`、`hash_length`、`output_ext`）全部不变时复用旧值，避免纯改文案产生无意义 diff。
   - 以 `json.dump(..., ensure_ascii=False, indent=2)` + `newline='\n'` 写出。
4. **targets & slot_formats（`pipeline/worker_targets.py`）**：
   - 必须成对写出，键按 `sorted(counts)` 排序，使用 `JSON.parse("...")` 双重转义保持纯数据形态与字节稳定。

### 容量估算与体积熔断

因为每个分类会扩散为 $16^L$ 个槽位，单文件超过 **5 MB** 会在扫描期熔断跳过。总构建体积估算公式：

$$S_{\text{total}} = \sum_{c=1}^{n} \left(16^L \times \bar{S}_c\right)$$

其中 $L$ 为 `--hash-length`（默认 `2`，即每类 256 槽），$\bar{S}_c$ 为分类 $c$ 内有效图片的平均体积。建议先将单图压缩至 2 MB 以内，图片库较大时保持 `--hash-length 2`。

### `--no-copy`、`--strict-formats` 与空输入

- **`--no-copy`**：文件名、槽位数、比例、`counts.json`、`targets.js`、`slot_formats.js`（只读源文件头）与真实拷贝逐字节一致，但槽位文件变为 1×1 占位字节。仅用于 CI 与临时测试，**不要在仓库根目录直接覆盖真实图片池**。
- **`--strict-formats`**：零写入前置闸门，检测到源文件真实字节与槽位后缀不符时直接打印报告并以退出码 `1` 中止，不创建任何目录或文件。
- **空输入与幂等**：`assets/original/` 不存在或无子目录时不写任何文件；源图不变时重跑产物逐字节一致。

---

## 3. 运行时内部（`worker/`）

`worker/index.js` 只做路由分发与 `Content-Type` 纠正，`worker/policy.js` 是唯一的策略引擎：

- **`/pic`**：交由 `handleRequest(request, env)` 执行策略检查、目标解析与 302 跳转。
- **其余路径**：先 `resolvePolicy(env)`（配置非法返回 `500 Internal Error`），再由 `parseCategoryImage` 判定是否为分类图片路径（`decodeURIComponent` 后正好 3 段、第 2 段是 `TARGETS` 自有键、第 3 段为图片后缀）：
  - 非分类图片（HTML、`/counts.json`、`/static/*`、`/fonts/*`）：原样透传 `env.ASSETS.fetch(request)`。
  - `PROTECT_ASSET_IMAGES=0`：取资产后仅调用 `withSlotContentType` 纠正 MIME。
  - `PROTECT_ASSET_IMAGES=1`（默认）：`checkAccess` → 取资产 → `responseHeaders` 重建响应头（覆盖为 `Cache-Control: private, no-store` 与 `Vary: Origin, Referer`，`HEAD` 传 `null` body）→ `withSlotContentType` 纠正 MIME。

### 关键运行时不变量

- **`assets.run_worker_first: true` 是承重配置**（`wrangler.jsonc`）：三个入口（`/pic`、直链 `/<cat>/<hex>.<ext>`、边缘重写 `/<cat>`）最终都落到同一份资产请求；若改为资产优先，已存在文件会绕过 Worker，导致访问策略与 MIME 纠正同时静默失效。
- **策略缓存与 fail closed**：`policyCache` 按 7 个环境变量拼接值在 isolate 级缓存；任何非法布尔/主机/Origin 配置均 fail closed 返回 `500`，错误详情只写 `console.error`。
- **拒绝不可区分**：Origin/Referer 被拒、未知分类、空分类统一返回 `404 Not Found`，防止探测白名单。
- **无证据不改写**：`withSlotContentType` 仅在 `response.ok` 且 `SLOT_FORMATS[cat][slot]` 为 `j/p/g/w` 时覆写 `Content-Type`；`?`、越界槽位、非十六进制文件名、404/304 均保留原头。

---

## 4. 五条主链路

1. **`/pic?img=<key>`（302 跳转）**：请求 → `resolvePolicy` → `checkAccess` → `resolveTarget`（`ua` 优先按移动 UA 正则分流到 `v`/`h`，其余查 `TARGETS`）→ 随机生成槽位相对路径 → 返回 `302`（`private, no-store`、`Vary`）→ 浏览器跟随进入链路 2。
2. **直链 `/<cat>/<hex>.<ext>`**：请求因 `run_worker_first: true` 先到 Worker → `parseCategoryImage` 命中 → 按 `PROTECT_ASSET_IMAGES` 决定是否校验策略 → 取 `env.ASSETS` → `withSlotContentType` 纠正 MIME 返回。
3. **边缘重写 `/<cat>`**：Cloudflare Transform Rules 用精确匹配 `eq "/<cat>"` 将路径内部重写为随机槽位 → 浏览器地址栏不变 → 重写后的请求进入链路 2，享有同样的策略与 MIME 纠正。
4. **画廊加载**：`src/pages/gallery.tsx` 用 `?cat=` 驱动当前分类 → `fetch("/counts.json")` 获取分类标签、有效数量、后缀与 `slot_ratios` → 按每槽真实宽高比预留卡片高度防重排 → 每页 20 张配合 `IntersectionObserver` 懒加载 → 委托绑定 Fancybox 灯箱。
5. **构建与部署**：`npm run gen` 生成图片池、清单与 Worker 数据模块 → `npm run build` 打包三个 HTML 入口、复制 `assets/static/` 并在 `closeBundle` 中将 `assets/generated/` 平铺拷入 `dist/` → `npm run deploy`（`wrangler deploy`）上传 `worker/index.js` 与 `./dist`。

---

## 5. 架构决策记录（ADR）

| ADR | 决定 | 否决方案与主要代价 |
| :--- | :--- | :--- |
| **ADR-1：Vite 取代 Next.js 静态导出** | Vite 7 多入口构建（`index.html`、`gallery.html`、`settings.html`）挂载同一 React Router SPA，`outDir: "dist"` | 摆脱 Next 静态导出文件名归一化脚本与后置搬运；代价是 `vite.config.ts` 需自定义 dev 中间件与 `closeBundle` 插件挂载 `assets/generated/` |
| **ADR-2：拆出 `pipeline/` 与外置契约** | 将原 900 行单脚本拆成按阶段划分的包，分类注册表进 `assets/catalog.json`，清单受 `assets/manifest.schema.json` 约束 | 消除前后端重复维护分类映射；代价是扫描顺序、键序、JSON 格式成为显式字节契约，不可随意“整理” |
| **ADR-3：Worker 手写源码、Python 只吐数据** | `worker/index.js` 与 `worker/policy.js` 手写，管线只输出 `worker/targets.js` 与 `worker/slot_formats.js` | 运行时代码可独立 lint 与单测；代价是 CI 必须用 `git diff` 校验数据模块未过期 |
| **ADR-4：目录归位** | 源图 `assets/original/`、手写静态 `assets/static/`、生成池 `assets/generated/`（仅 `counts.json` 入库）、构建产物 `dist/` | 彻底隔离 1 GB 生成物与源码树；代价是 dev 中间件需将生成物平铺映射到根路径 |
| **ADR-5：单后缀 + 运行时 `Content-Type` 覆盖** | 分类维持单一后缀以兼容静态边缘重写规则，通过 `worker/slot_formats.js` 在运行时覆写实际 MIME | 否决了逐槽位后缀（破坏静态重写且改 234 个槽位 URL）与强制转码（`a/` 下 24 张 RGBA PNG 转 JPEG 会丢透明通道）；代价是依赖 `run_worker_first: true` |
| **ADR-6：边缘重写用 `eq` + `/static` 产物目录** | Transform Rules 用精确匹配 `http.request.uri.path eq "/<cat>"`，Vite `assetsDir` 改为 `/static` | 否决了 `starts_with("/a")`（曾吞掉 `/assets/*` 致站点白屏）、扩展名终止（锁死全站单后缀）与 `matches`（需付费套餐）；代价是每分类一条规则且需人工同步 `--hash-length` 与后缀 |

### 已知遗留与基线

- 真实源图库存在历史后缀漂移（`a` 56/114、`h` 43/138、`v` 7/67 源文件；对应 125/81/28 个槽位），由 `tests/pipeline/test_pipeline.py` 以**只降不增**基线守卫；新分类必须保持零漂移。
- `pipeline/catalog.py` 保留了 `TODO(P3)`，记录将 `h`/`v` 切到 `ext_policy: "source"` 的潜在变更（会改变 URL，需重建池）。
