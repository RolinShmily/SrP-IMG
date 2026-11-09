# 截图

四张截图由根 README 的预览章节引用，文件实际位于 `docs/screenshots/`。它们只用于展示界面状态，不作为视觉基线。

## 清单

| 文件 | 像素尺寸 | 主题 | 路由 | 画面内容 |
| :--- | :--- | :--- | :--- | :--- |
| `docs/screenshots/home.webp` | 1200×958 | 亮色 | `/` | Hero（徽章、主标题、副标题、两个行动按钮）+ "在线实时体验"区上半部，含顶栏胶囊与 `LivePreview` 分类 Tab |
| `docs/screenshots/gallery.webp` | 1200×750 | 暗色 | `/gallery?cat=h` | 标题、分类 Tab（当前 横屏壁纸 138）、四列瀑布流首屏 |
| `docs/screenshots/api.webp` | 1200×750 | 亮色 | `/settings` | "API 调用指南"页，`ApiPanel` 展开态：基准域名、过滤与格式切换、`/pic?img=*` 与直链卡片 |
| `docs/screenshots/mobile.webp` | 390×844 | 亮色 | `/` | 移动端首页：顶栏只剩品牌 + 语言/仓库/主题/汉堡，Hero 与 `LivePreview` 纵向堆叠 |

尺寸取自文件本身（图像元数据），四个文件均为 WebP。尺寸与设备对应关系（DPR、是否整页截取）无法从仓库确认，见文末。

## README 引用位置

| 位置 | 引用 |
| :--- | :--- |
| `README.md` 的 Preview 小节 | `home.webp` 直接内嵌；`<details>` 内放 `gallery.webp`、`api.webp`、`mobile.webp`，摘要为 `More screenshots — gallery, API reference, mobile` |
| `README_zh.md` 的“前端预览”小节 | 同上；摘要为 `更多截图 —— 画廊、API 参考、移动端` |

目录用途在 README 的仓库结构里注明为"README 预览章节使用的截图"（`README.md`、`README_zh.md`）。

## 再生成

前置：本地能正常出现图片与分类数量，否则画廊会落到 `loadError` 分支、`ApiPanel` 会只在默认分类上生成卡片（`src/components/image-gallery.tsx`、`src/components/api-panel.tsx`）。

1. `npm run dev` 启动 Vite；如提示缺少 `assets/generated/`，先跑 `npm run gen`（即 `python -m pipeline --hash-length 2`），依赖关系见 [../development/build.md](../development/build.md)。
2. 截图路由与主题按上表对号：`/` 与 `/settings` 用亮色，`/gallery?cat=h` 用暗色，通过顶栏 `ModeToggle` 切换（`src/components/mode-toggle.tsx`）。
3. 桌面图按 1200 宽取景：首页取到 Hero 底部与实时体验区可见处（约 958 高），画廊与 API 页取 750 高首屏。
4. 移动图按 390×844 视口取景；该宽度下 `sm` 断点不生效，顶栏自动收成汉堡（`src/components/navbar.tsx`）。
5. 导出为 WebP，覆盖同名文件；不要新增引用路径，README 已按固定文件名链接。

截图不含滚动条区域以外的交互态（Fancybox 灯箱、抽屉展开、复制成功）——这些状态目前没有截图。

## 画面元素对照

| 画面元素 | 组件 | 出处 |
| :--- | :--- | :--- |
| 浮动胶囊顶栏、当前页下划线圆点 | `Navbar` | `src/components/navbar.tsx` |
| 语言按钮（`EN`/`中`）、主题按钮（`Sun`/`Moon`） | `LangToggle`、`ModeToggle` | `src/components/lang-toggle.tsx`、`src/components/mode-toggle.tsx` |
| Hero 徽章、两个 CTA | `src/pages/home.tsx` 内联 | `src/pages/home.tsx` |
| 分类 Tab + `换一张` / `复制直链` | `LivePreview` | `src/components/live-preview.tsx` |
| 点阵背景的图片舞台 | `.preview-stage` | `src/globals.css` |
| 分类 Tab 与数量徽标 | `GalleryContent` | `src/pages/gallery.tsx` |
| 四列瀑布流卡片 | `ImageGallery` | `src/components/image-gallery.tsx` |
| 折叠头、双模式徽章、域名区 | `ApiPanel` 头部 | `src/components/api-panel.tsx` |
| 过滤与格式切换、三列接口卡片、`URL`/`MD`/`HTML`/`测试` | `ApiPanel` 主体 | `src/components/api-panel.tsx` |
| 汉堡按钮（无桌面导航） | `Navbar` 的 `sm:hidden` 分支 | `src/components/navbar.tsx` |

## 已知偏差

- `home.webp` 与 `mobile.webp` 里的副标题仍是"基于 Cloudflare Workers 与 Next.js 构建的多分类随机图片 API"，而当前字典写的是"Cloudflare Workers 与 Vite + React"（`src/lib/i18n.tsx`）。说明这两张图早于该文案变更，重生成时会自动同步。
- `gallery.webp` 使用暗色主题，README 的 `alt` 也写明"深色模式下的瀑布流画廊"；换主题重生成会与 `alt` 不符，需同步改 `alt`。
- 四个文件的修改时间为 2025-10-27，早于当前 `src/` 的多处改动，其余差异未逐项比对。

## 待确认

- 抓图工具、DPR 与 WebP 质量参数：仓库内没有任何截图脚本或命令记录，无法确认。
- `home.webp` 是"整页截取后裁切"还是"视口截取"：从高度 958 不足以判定。
- `mobile.webp` 对应的具体机型与浏览器：只知文件为 390×844，与常见移动视口一致。
- 截图是否需要随每次 UI 变更更新，仓库没有约定；`CHANGELOG.md` 里也没有截图相关条目。
