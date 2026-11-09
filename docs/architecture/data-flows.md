# 五条主链路

五条链路覆盖全部读写路径：三条入口、一条画廊加载、一条构建与部署。每条链路只写编号步骤与参与者，不重复各分册的规则细节。

## ① `/pic?img=<key>`：302 跳转

参与者：浏览器 → Worker（`handleRequest`）→ `worker/policy.js` → `worker/targets.js`。

1. 浏览器请求 `/pic?img=h`；Worker 入口按路径前缀分流到 `handleRequest`（`worker/index.js`）。
2. `resolvePolicy(env)` 解析七个环境变量；命中 `policyCache` 就复用，非法配置直接返回 500（`worker/policy.js`）。
3. `checkAccess` 依次检查 Origin、方法（`GET`/`HEAD`/`OPTIONS`）、Referer；不通过时回 404 或 405（`worker/policy.js`）。
4. `resolveTarget` 读 `img` 参数：`ua` 用 `MOBILE_UA` 正则决定 `TARGETS.v` 还是 `TARGETS.h`，其余按 `TARGETS` 自有键查表（`worker/policy.js`）。
5. 目标缺失或 `slots < 1` → 404（`worker/policy.js`）。
6. `randomImagePath` 取 `Math.floor(Math.random() * slots)`，`toString(16).padStart(HASH_LENGTH, '0')`，拼上 `target.ext || IMAGE_EXT`（`worker/policy.js`）。
7. 返回 `302`，头由 `responseHeaders` 生成：`Location` + `Vary: Origin, Referer` + `Cache-Control: private, no-store`（`worker/policy.js`）。
8. 浏览器跟随 `Location` 进入链路 ②，因此同一个请求会第二次经过 Worker（`wrangler.jsonc`）。

## ② 直链 `/<category>/<hex>.<ext>`

参与者：浏览器或画廊 → Worker（资产分支）→ `env.ASSETS` → `worker/slot_formats.js`。

1. 请求形如 `/h/00.jpg`、`/a/01.jpeg`、`/gif/0a.gif`（`src/components/image-gallery.tsx`）。
2. `run_worker_first: true` 使请求先到 Worker，而不是直接命中静态资产（`wrangler.jsonc`）。
3. `parseCategoryImage` 解码路径、要求三段、第二段在 `TARGETS` 中、第三段是图片后缀，并把十六进制前缀解析成槽位号（`worker/index.js`）。
4. 不是分类图片（`/counts.json`、HTML、`/static/*` bundle、图标）→ 直接 `env.ASSETS.fetch`，不加策略头（`worker/index.js`）。
5. `PROTECT_ASSET_IMAGES=1`（默认）：`checkAccess` → 取资产 → 用 `responseHeaders` 重建头（HEAD 传 `null` body）→ 纠正 MIME（`worker/index.js`）。
6. `PROTECT_ASSET_IMAGES=0`：取资产后只纠正 MIME，保留 `_headers` 的长缓存（`worker/index.js`、`assets/static/_headers`）。
7. `withSlotContentType` 在 `response.ok` 且格式码已知时覆写 `Content-Type`；`?`、越界槽位、404 都原样放行（`worker/index.js`）。
8. 返回图片；若策略拒绝，得到与"图片不存在"相同的 404（`worker/policy.js`）。

## ③ 规则层 `/<category>`：边缘重写

参与者：浏览器 → 边缘规则（Transform Rules）→ Worker → `env.ASSETS`。

1. 浏览器请求 `/h`，浏览器地址栏保持 `/h`（`docs/reference/transform-rules.md`）。
2. 边缘规则匹配 `http.request.uri.path matches "^/h/?$"`，命中后把路径重写为 `concat("/h/", substring(uuidv4(cf.random_seed), 0, 2), ".jpg")`（`docs/reference/transform-rules.md`）。
3. 重写后的 `/h/ab.jpg` 不再匹配 `^/h/?$`，规则无法递归；匹配条件与扩展名无关，因此 `.jpeg`/`.gif` 分类共用同一形状（`docs/reference/transform-rules.md`）。
4. 重写请求仍是普通资产请求，于是回到链路 ② 的第 2 步（`wrangler.jsonc`）。
5. 因此策略与 MIME 纠正对这一入口同样生效，代价是每个请求都过一次 Worker，且在 `PROTECT_ASSET_IMAGES=1` 时不可被 CDN 缓存（`docs/reference/transform-rules.md`）。
6. 规则数量、`substring` 长度（必须等于 `--hash-length`）与分类后缀是三条人工同步项（`docs/reference/transform-rules.md`、`assets/catalog.json`）。

## ④ 画廊加载：`counts.json` → 槽位 URL → Fancybox

参与者：`src/pages/gallery.tsx` → `src/components/image-gallery.tsx` → `/counts.json` → 槽位直链 → Fancybox。

1. 画廊页用 `useSearchParams` 读 `?cat=`，默认 `h`；切分类时写回 URL，浏览器前进/后退因此可回放（`src/pages/gallery.tsx`）。
2. `fetch("/counts.json")`：优先用 `data.categories` 渲染标签，失败则退回 `real_counts`/`counts` 的键序（`src/pages/gallery.tsx`）。
3. `ImageGallery` 再次 `fetch("/counts.json")`，从 `real_counts[folder]` 取可见数量，`hash_length` 取文件名长度，`category_exts[folder]` 或 `output_ext` 取后缀，`slot_ratios[folder]` 取每槽比例（`src/components/image-gallery.tsx`）。
4. 校验：数量必须是非负安全整数，`hashLength` 在 1–32，后缀必须匹配 `/^\.[a-z0-9]+$/i`，否则标记加载失败（`src/components/image-gallery.tsx`）。
5. `useMemo` 生成 URL：`/${encodeURIComponent(folder)}/${id.toString(16).padStart(hashLength, "0")}${fileExt}`，比例用 `slotRatios[id % slotRatios.length]`（`src/components/image-gallery.tsx`）。
6. 每页 20 张，`IntersectionObserver`（`rootMargin: "200px"`）触底追加，`<img loading>` 前 8 张 `eager`、其余 `lazy`（`src/components/image-gallery.tsx`）。
7. 每个 `<a data-fancybox="gallery" href={image.url}>` 与 `<img src={image.url}>` 指向同一槽位直链；`Fancybox.bind(container, "[data-fancybox]", options)` 在挂载时绑定、卸载时 `unbind`（`src/components/image-gallery.tsx`）。
8. 图片请求进入链路 ②；`/counts.json` 本身不是图片路径，由资产直接返回，`_headers` 给出 `public, max-age=0, must-revalidate`（`worker/index.js`、`assets/static/_headers`）。

## ⑤ 构建与部署：gen → build → wrangler

参与者：`python -m pipeline` → Vite → wrangler。

1. `npm run gen` 执行 `python -m pipeline --hash-length 2`，写出 `assets/generated/`、`counts.json`、`worker/targets.js`、`worker/slot_formats.js`（`package.json`、`pipeline/cli.py`）。
2. `npm run build` 执行 `vite build`：三个 HTML 入口 + `publicDir = assets/static` → `dist/`，`emptyOutDir: true` 全量重写（`vite.config.ts`）。
3. `closeBundle` 阶段把 `assets/generated/` 平铺拷进 `dist/`：子目录递归拷贝，`counts.json` 单文件拷贝；`assets/generated/` 不存在时直接抛错要求先跑 `npm run gen`（`vite.config.ts`）。
4. 结果 `dist/` 含三个 HTML、哈希 bundle、`counts.json`、`<category>/<hex>.<ext>`、`_headers`、`icon.svg`、`fonts/`（`vite.config.ts`、`assets/static/_headers`）。
5. `npm run deploy` 执行 `wrangler deploy`，按 `wrangler.jsonc` 上传 `./dist` 为 `ASSETS`，并把 `worker/index.js` 作为入口部署到 `img.srprolin.com/*` 路由（`package.json`、`wrangler.jsonc`）。
6. 本地 `npm run dev` 时不拷贝：dev 中间件在 Vite 自身中间件之前挂载，直接服务 `/counts.json` 与 `/<category>/<hex>.<ext>`，`counts.json` 带 `Cache-Control: no-cache`（`vite.config.ts`）。
7. CI 侧用 `--no-copy` 生成占位字节，再 `git diff --exit-code` 校验 `worker/targets.js`、`worker/slot_formats.js`、`assets/generated/counts.json` 未过期（`.github/workflows/ci.yml`）。
8. 部署侧从真实源池完整生成，再 build 与 deploy，文档类改动被 `paths-ignore` 跳过（`.github/workflows/deploy.yml`）。

## 链路与层的对应

| 链路 | 经过的层 | 可缓存性 |
| :--- | :--- | :--- |
| ① `/pic` | 运行时 | 302 本身为 `private, no-store` |
| ② 直链 | 运行时 + 部署产物 | 保护开启时 `private, no-store`；关闭时按 `_headers` |
| ③ 边缘重写 | 边缘 + 运行时 + 部署产物 | 同 ② |
| ④ 画廊 | 展示层 + 部署产物 | `counts.json` 每次重验证，图片同 ② |
| ⑤ 构建部署 | 构建层 + 展示层 + 部署产物 | 不涉及请求 |
