# 前端设计与规范

本文整理 imgroll 的设计 token、组件约定、动效规范、双语与无障碍实现，以及 README 预览截图说明。

## 1. 设计 Token

颜色、字体、间距与圆角统一定义在 `src/globals.css`，通过三层结构消费：

1. **原始变量**：`:root`（亮色）与 `.dark`（暗色）中的 `oklch(...)` 变量。
2. **主题映射**：`@theme inline` 将原始变量映射为 `--color-*`、`--font-*`、`--radius-*` 等 Tailwind 工具类。
3. **组件消费**：仅使用语义类名（如 `bg-card/75`、`text-muted-foreground`、`border-border/60`），禁止在 `src/` 新增裸色值。

### 颜色与明暗主题

| 变量 | 亮色 | 暗色 | 用途 |
| :--- | :--- | :--- | :--- |
| `--background` / `--foreground` | `oklch(0.98 0 0)` / `oklch(0.15 0 0)` | `oklch(0.12 0 0)` / `oklch(0.96 0 0)` | 页面底色与主文字 |
| `--card` / `--card-foreground` | `oklch(1 0 0)` / `oklch(0.15 0 0)` | `oklch(0.16 0 0)` / `oklch(0.96 0 0)` | 卡片与顶栏胶囊底（暗色靠亮度抬升而非阴影区分） |
| `--primary` / `--primary-foreground` | `oklch(0.15 0 0)` / `oklch(0.98 0 0)` | `oklch(0.96 0 0)` / `oklch(0.12 0 0)` | 主按钮、选中态、强调 |
| `--muted` / `--muted-foreground` | `oklch(0.92 0 0)` / `oklch(0.5 0 0)` | `oklch(0.2 0 0)` / `oklch(0.65 0 0)` | 弱化背景与次要文字 |
| `--destructive` / `--border` / `--ring` | 语义红 / `0.88` / `0.5` | 语义红 / `0.25` / `0.5` | 失败状态、描边与全局焦点环 |

- **防首帧闪烁**：三个入口 HTML（`index.html`、`gallery.html`、`settings.html`）内置脚本，在挂载前按 `localStorage["theme"]` / 系统偏好写入 `html.dark` 与 `colorScheme`。
- **运行时切换**：`ThemeProvider` 封装 `next-themes`（`attribute="class"`、`defaultTheme="system"`、`enableSystem`、`disableTransitionOnChange`）；状态色必须亮暗成对书写（如 `text-emerald-600 dark:text-emerald-400`）。

### 字体、字号、间距与圆角

- **自托管字体**：`assets/static/fonts/` 存放 `geist-latin.woff2` 与 `geist-mono-latin.woff2`，通过 HTML `preload` 与 `font-display: swap` 加载，并配置 `Geist Fallback` / `Geist Mono Fallback` 度量对齐；sans 回落链显式包含 `PingFang SC`、`Microsoft YaHei`。
- **字重与字距**：仅使用 `font-bold`（标题）、`font-semibold`（卡片标题/品牌）、`font-medium`（控件）与常规正文；标题使用 `tracking-tight`，计数与路径使用 `font-mono`。
- **布局与圆角**：页面容器统一 `px-4` + `max-w-4xl` ~ `max-w-7xl`；顶栏 `h-14`；圆角以 `--radius: 0.625rem` 派生 `sm/md/lg/xl`（6/8/10/14px），卡片用 `rounded-2xl`，胶囊与徽章用 `rounded-full`。

---

## 2. 复用组件

界面由 7 个具名导出组件构成，图标统一标记 `aria-hidden="true"`：

| 组件 | 文件 | 职责与核心约束 |
| :--- | :--- | :--- |
| `Navbar` | `src/components/navbar.tsx` | 浮动胶囊顶栏与移动抽屉。外壳 `pointer-events-none`，交互层显式 `pointer-events-auto`；`<header>` 靠 `data-scrolled`（>20px）、`data-retracted`（>350px 且下滑）、`data-menu` 驱动样式；skip-link 为首个可聚焦元素指向 `#main-content`；路由变化在渲染期同步关抽屉避免闪帧。 |
| `Footer` | `src/components/footer.tsx` | 品牌、标语、外链（源码 / 文档 / 博客）、固定版权声明 `© 2025–2026 RoL1n_SrP`、MIT 许可与回顶按钮。外链统一 `target="_blank" rel="noopener noreferrer"`。 |
| `ImageGallery` | `src/components/image-gallery.tsx` | 瀑布流画廊。按 `folder` 作 `key` 隔离分类状态；读 `/counts.json` 的 `slot_ratios` 预留每格 `aspectRatio` 避免滚动重排（缺失回落 `4/3`）；每页 20 张 + `IntersectionObserver`（`200px` 提前量）追加；Fancybox 委托绑定且仅随 `lang` 重绑；复制支持剪贴板降级并通过 `sr-only` 状态区播报。 |
| `ApiPanel` | `src/components/api-panel.tsx` | 可折叠 API 速查面板。读 `/counts.json` 动态生成 `/pic?img=<key>`、`<key>` 直链及 `ua` 卡片，基准域名取 `window.location.origin`；展开收起用 `grid-rows-[0fr/1fr]` + `inert`（不条件卸载子树）；分类固定 `h/v/a/gif` 在前；英文界面过滤中文 `aspect_hint`。 |
| `LivePreview` | `src/components/live-preview.tsx` | 首页实时预览。通过 `/pic?img=<cat>&_t=<seed>` 换图；`.preview-stage` 点阵底 + `object-contain` 零裁切；20 秒超时判失败并提供重试；复制失败显式提示不静默。 |
| `ModeToggle` | `src/components/mode-toggle.tsx` | 主题开关。用 `useSyncExternalStore` 避免水合闪烁（未挂载前渲染 `size-9` 占位），持久化完全交给 `next-themes`。 |
| `LangToggle` | `src/components/lang-toggle.tsx` | 语言开关。固定 `h-9 w-12`，文字显示**目标语言**（`EN` / `中`），文档副作用集中在 `I18nProvider`。 |

---

## 3. 动效规范

动效仅服务三件事：路由淡入、顶栏滚动形态与回缩、抽屉/面板展开收起。

- **只动合成属性**：路由淡入（`180ms ease-out`，仅 `opacity: 0.55 → 1`）、画廊淡入（`140ms`）、顶栏回缩（`0.3s cubic-bezier(0.16, 1, 0.3, 1)`、`translateY(-5.5rem)`）均不触发布局重排；抽屉与 `ApiPanel` 例外使用 `grid-template-rows`（≤300ms）。
- **顶栏手势**：宽屏（`>=800px`）滚动后胶囊内收 `margin-inline: 8%`；超过 350px 且向下滚回缩，向上滚立即复位；移动抽屉打开或开启减少动效时禁止回缩；滚动监听带 `{ passive: true }`。
- **减少动效（`prefers-reduced-motion: reduce`）**：全局压缩动画/过渡时长至 `0.01ms`、`scroll-behavior: auto`；骨架与过渡禁用动画；回顶切换为 `behavior: "instant"`。
- **`disableTransitionOnChange`**：`ThemeProvider` 切换主题时瞬间关闭过渡，避免整页变量切换产生 300ms 灰阶闪烁；因此不要依赖 `transition-colors` 驱动状态机。

---

## 4. 双语与可达性

### 国际化（i18n）

- 字典拆分三处：`src/lib/i18n.tsx`（全局骨架文案）、`src/lib/gallery-translations.ts`（带序号/数量参数的画廊文案）、`src/lib/api-translations.ts`（API 面板文案）。
- 语言持久化于 `localStorage["imgroll_lang"]`（仅 `"zh" | "en"`），读取顺序为 `localStorage → 内存偏好 → navigator.language → "zh"`，并通过 `storage` 事件跨标签同步；写入异常降级为标签页内生效。
- `I18nProvider` 统一维护 `document.documentElement.lang`（`zh-CN` / `en`）、`document.title`（`页面名 · 标题`）与 `meta[name="description"]`，其他组件不得直接修改。

### 键盘与 ARIA 约定

- **skip-link & 焦点环**：`<header>` 首个元素为 skip-link；全局 `:focus-visible` 提供 `2px solid var(--ring)` 与 `3px` 偏移。
- **隐藏面板隔离**：关闭的移动抽屉与折叠的 `ApiPanel` 均设置 `inert` 防止焦点进入。
- **语义角色**：当前导航 `aria-current="page"`；分类/过滤/格式按钮用原生 `<button>` + `aria-pressed`；折叠触发器带 `aria-expanded` + `aria-controls`；复制/加载状态走 `role="status"` + `aria-live="polite"`（不用 `alert()`）；错误状态用 `role="alert"`；Fancybox 配置 `placeFocusBack: true` 与 `PageUp/PageDown` 翻页。
- **图片替代文本**：顶栏品牌图 `alt=""`（相邻文字已提供名称）；画廊图片与操作按钮按序号提供中英文 `alt` / `aria-label`。

---

## 5. 预览截图

README 预览截图统一存放在 `assets/screenshots/`，均为 WebP 格式：

| 文件 | 尺寸 | 主题 | 路由 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `assets/screenshots/home.webp` | 1200×1421 | 亮色 | `/` | 顶栏 + Hero + 完整「在线实时体验」模块 |
| `assets/screenshots/gallery.webp` | 1200×750 | 暗色 | `/gallery?cat=h` | 深色模式四列瀑布流画廊 |
| `assets/screenshots/api.webp` | 1200×750 | 亮色 | `/settings` | API 指南与展开的 `ApiPanel` |
| `assets/screenshots/mobile.webp` | 390×844 | 亮色 | `/` | 移动端首页（汉堡菜单 + 纵向堆叠） |

更新截图时确保已生成图片池（`npm run gen`）并启动本地服务（`npm run dev`）或直接对线上站点截屏，导出为 WebP 覆盖同名文件即可。
