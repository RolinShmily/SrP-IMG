# 复用组件

七个组件构成全部界面。它们都是具名导出，样式用模板字符串拼类名（`src/lib/utils.ts` 的 `cn()` 目前未被 `src/` 引用），图标统一 `aria-hidden="true"`。

| 组件 | 文件 | 类型 | 用在 |
| :--- | :--- | :--- | :--- |
| `Navbar` | `src/components/navbar.tsx` | 布局 + 导航 | 三页顶部 |
| `Footer` | `src/components/footer.tsx` | 布局 | 三页底部 |
| `ImageGallery` | `src/components/image-gallery.tsx` | 数据驱动列表 | `/gallery` |
| `ApiPanel` | `src/components/api-panel.tsx` | 可折叠说明面板 | `/settings` |
| `LivePreview` | `src/components/live-preview.tsx` | 交互演示 | `/` |
| `ModeToggle` | `src/components/mode-toggle.tsx` | 主题开关 | `Navbar` |
| `LangToggle` | `src/components/lang-toggle.tsx` | 语言开关 | `Navbar` |

## Navbar

浮动胶囊顶栏：品牌、三个主链接、语言/仓库/主题/汉堡按钮，负责首屏导航与移动端抽屉。

| 项目 | 实现 |
| :--- | :--- |
| props | 无（语言与文案来自 `useI18n()`） |
| 本地状态 | `mobileMenuOpen`、`scrolled`、`retracted`、`prevPath`；`useRef` 记 `lastY`、`menuOpenRef` |
| 滚动阈值 | `MORPH_AT = 20` 触发 `data-scrolled`；`HIDE_AFTER = 350` 且继续下滑才 `data-retracted` |
| DOM 三态 | `<header>` 上的 `data-scrolled` / `data-retracted` / `data-menu="open\|closed"` |
| 移动抽屉 | `#mobile-navigation-panel`，关闭时 `inert`，按钮 `aria-expanded` + `aria-controls` 指向它 |
| 当前页 | `aria-current="page"`，另加一枚 `aria-hidden` 的下划线圆点 |

约束：

- 外壳 `sticky top-2 sm:top-4 z-50 pointer-events-none`，只有交互层加 `pointer-events-auto`；新增元素必须显式打开指针事件（`src/components/navbar.tsx`）。
- 路由变化时关抽屉用渲染期判断（`prevPath !== pathname`），不要改回 `useEffect`，否则会多一帧展开态（`src/components/navbar.tsx`）。
- skip-link 必须是 `<header>` 内第一个可聚焦元素，目标固定 `#main-content`（`src/components/navbar.tsx`、`src/pages/*.tsx`）。
- 抽屉只能改 `data-menu`，不要 `display: none`，展开动画依赖 `grid-template-rows`（`src/globals.css`）。
- 减少动效或抽屉打开时不得回缩，逻辑已写在 `onScroll` 里（`src/components/navbar.tsx`）。

反例：在页面里另写一个 `<header>` 或 `fixed` 导航条；给品牌图加语义化 `alt`（当前是 `alt=""`，文字已给出名称）。

## Footer

页脚：品牌、标语、四个外链、版权、许可与回到顶部。

| 项目 | 实现 |
| :--- | :--- |
| props | 无；链接常量 `REPOSITORY`/`RELEASES`/`DOCS`/`BLOG`/`LICENSE` 写在文件头 |
| 交互 | `scrollToTop()` 平滑回顶；品牌链接在 `/` 上改为回顶而不是跳转 |
| 结构 | 上排品牌 + `nav aria-label`；下排版权、许可、回顶按钮 |

约束：

- 外链一律 `target="_blank" rel="noopener noreferrer"`，箭头图标 `aria-hidden`（`src/components/footer.tsx`）。
- 版权年份是字面量 `© 2025–2026 RoL1n_SrP`，不要改成动态计算（`src/components/footer.tsx`）。
- 分隔用 `border-t border-border/50` 与 `·` 字符，`·` 需 `aria-hidden`（`src/components/footer.tsx`）。

反例：把页脚链接接进 `useI18n` 之外的硬编码中文；在已有回顶按钮时再叠一个浮动按钮。

## ImageGallery

瀑布流图库：读 `counts.json`、分页追加、按真实比例预留盒子、Fancybox 预览、复制直链。

| 项目 | 实现 |
| :--- | :--- |
| props | `{ type: string }`，映射 `horizontal→h`、`vertical→v`、`avatar→a`，其余原样作为目录名 |
| 内部组件 | `GalleryImages` 以 `folder` 为 `key`，切换分类即重置分页与复制状态 |
| 数据 | `fetch("/counts.json")`，取 `real_counts`/`counts`、`hash_length`、`category_exts`、`slot_ratios`、`category_aspects` |
| 分页 | `IMAGES_PER_PAGE = 20`，`IntersectionObserver` 提前 `200px` 追加；保留"加载更多"按钮兜底 |
| 布局 | `columns-1 min-[360px]:columns-2 md:columns-3`，`gif` 为 `lg:columns-5`，其余 `lg:columns-4` |
| 比例 | 每格 `style={{ aspectRatio }}`，取 `slotRatios[id % slotRatios.length]`，缺失回落 `DEFAULT_RATIO = 4/3` |
| 复制 | `navigator.clipboard.writeText`，失败回落 `execCommand("copy")`，用 `copyGenerationRef` 丢弃过期结果 |
| 反馈 | `role="status" aria-live="polite"` 的 `sr-only` 段落播报复制结果；按钮本身切换"复制中/已复制/复制失败" |

约束：

- 必须按真实比例预留高度，否则位图到达会重排并产生滚动抖动；`width`/`height={800}` 只是提示，布局由 `aspectRatio` 决定（`src/components/image-gallery.tsx`）。
- Fancybox 只在 `lang` 变化时重新绑定，绑定是委托式的，新追加的图片自动生效；不要在分页时解绑（`src/components/image-gallery.tsx`）。
- 复制按钮在支持悬停的设备上默认透明，靠 `group-hover`/`group-focus-within`/`focus-visible` 显现；键盘路径必须保留（`src/components/image-gallery.tsx`）。
- `columns-*` 是纵向填充的 CSS 多列，DOM 顺序沿列向下，Tab 顺序与视觉行序不完全一致；不要据此推断"行优先"的键盘路径（`src/components/image-gallery.tsx`）。
- 图片失败要落到占位文案而不是留空盒；`onError` 只能加一次（`src/components/image-gallery.tsx`）。

反例：用 `img` 自身尺寸撑开格子；在分类切换时复用同一个组件实例（会串数据，页面已用 `key={galleryType}` 规避）。

## ApiPanel

可折叠的接口速查表：域名、分类与格式过滤、每张卡片三种复制格式、在线测试。

| 项目 | 实现 |
| :--- | :--- |
| props | `{ defaultOpen?: boolean }`，默认 `false`；`/settings` 传 `true` |
| 状态 | `isOpen`、`filterCategory`（`all`/`query`/`direct`）、`previewFormat`（`url`/`markdown`/`html`）、`copiedKey`、`copyStatus` |
| 数据 | `fetch("/counts.json")` 覆盖 `categoryExts` 与 `serverCategories`；失败保留 `BASE_DEFAULT_CATEGORIES` |
| 生成规则 | 每个分类一条 `/pic?img=<key>`、一条 `/<key>`；存在 `h` 与 `v` 时追加 `/pic?img=ua` |
| 展开动效 | 外层 `grid-rows-[0fr]` ↔ `grid-rows-[1fr]` + `opacity`，关闭时 `inert` + `aria-hidden` |
| 无障碍 | 触发器 `aria-expanded` + `aria-controls={panelId}`（`useId`）；复制状态走 `role="status" aria-live="polite" aria-atomic="true"` |

约束：

- 折叠用 grid 行高，不要条件渲染子树，否则丢失过渡与焦点语义（`src/components/api-panel.tsx`）。
- 域名取 `window.location.origin`，占位回落 `https://img.srprolin.com`；不要写死生产域名（`src/components/api-panel.tsx`）。
- 分类顺序固定 `h`、`v`、`a`、`gif` 在前，其余按 `localeCompare` 追加（`src/components/api-panel.tsx`）。
- 复制成功后的高亮 2 秒后自动清除，且必须能被新的复制请求打断（`copyRequestRef`）（`src/components/api-panel.tsx`）。
- 英文界面不得出现中文 `aspect_hint`，用 `\p{Script=Han}` 判断后回落本地化文案（`src/components/api-panel.tsx`）。

反例：把接口清单写成硬编码数组（新分类不会出现）；用 `alert` 反馈复制结果。

## LivePreview

首页的实时演示：切分类、换一张、复制直链，并显示图片状态。

| 项目 | 实现 |
| :--- | :--- |
| props | `{ categories: PreviewCategory[] }`，元素为 `{ key, labelZh, labelEn }` |
| 状态 | `request: { category, seed }`、`status: loading/loaded/error`、`copyState: idle/copied/error` |
| 请求 | `src = /pic?img=<category>&_t=<seed>`，`seed` 递增即换图 |
| 超时 | 子组件 `PreviewImage` 20 秒未 `load` 即判失败 |
| 无障碍 | 分类按钮 `aria-pressed`；舞台 `aria-busy`；状态区 `role="status"`；复制失败用 `aria-live="polite"` 文本 |

约束：

- 舞台固定 `.preview-stage`（`clamp(20rem, 52vw, 34rem)` + 点阵底），图片 `object-contain`，不裁切（`src/globals.css`、`src/components/live-preview.tsx`）。
- 失败态必须给出重试入口，换图时重置为 `loading`（`src/components/live-preview.tsx`）。
- 复制只用 `navigator.clipboard`，失败显示 `t.home.copyFailed`，不静默（`src/components/live-preview.tsx`）。

反例：直接 `<img src="/pic?img=h">` 而不带超时与错误兜底；在演示区做裁切以"填满"卡片。

## ModeToggle

主题开关。读 `resolvedTheme` 决定图标（暗色显示 `Moon`，亮色显示 `Sun`），点击在 `light`/`dark` 间切换。

- 挂载前用 `useSyncExternalStore` 返回 `false`，渲染 `<div className="size-9" />` 占位，避免布局抖动与水合不一致（`src/components/mode-toggle.tsx`）。
- `title` 与 `aria-label` 都取 `t.nav.switchTheme`；焦点环是 `focus-visible:ring-1 focus-visible:ring-ring`（`src/components/mode-toggle.tsx`）。
- 约束：不要在组件内自己读写 `localStorage`，持久化归 `next-themes`（`src/components/theme-provider.tsx`）。

反例：首屏直接按 `resolvedTheme` 渲染图标（SSR/水合时会闪错图标）。

## LangToggle

语言开关。按钮显示"目标语言"（中文界面显示 `EN`，英文界面显示 `中`），点击调 `setLang`。

- 尺寸固定 `h-9 w-12`，与 `size-9` 的图标按钮并排时不破坏胶囊高度（`src/components/lang-toggle.tsx`）。
- `title`/`aria-label` 使用 `t.nav.switchLanguage`（"切换为英语"/"Switch to Chinese"），即告知点击后的结果而不是当前状态（`src/lib/i18n.tsx`）。
- 约束：语言副作用（`document.title`、`<html lang>`、`meta description`）只在 `I18nProvider` 里做，组件不重复实现（`src/lib/i18n.tsx`）。

反例：用 `aria-pressed` 表达当前语言（这是"切换动作"，不是开关状态）；在页面里再放一套语言按钮。
