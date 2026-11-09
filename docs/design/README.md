# Design

`src/` 与三个 HTML 入口的视觉规范：长什么样、怎么动、怎么念出来。数据结构、URL 形状与构建顺序不在本分册，见 [../architecture/layers.md](../architecture/layers.md)。

## 设计目标

| 目标 | 落地方式 | 出处 |
| :--- | :--- | :--- |
| 产品展示型 SPA | 三页共用 `Navbar` + `Footer`，无侧边栏、无嵌套路由 | `src/app.tsx`、`src/pages/home.tsx` |
| 三条路由 | `/`、`/gallery`、`/settings`，未命中 `Navigate to="/"` | `src/app.tsx` |
| 三个静态入口 | `index.html`、`gallery.html`、`settings.html` 各自带标题、主题预置脚本与字体 preload | `vite.config.ts`、`index.html` |
| 深浅主题 | `next-themes` 切 `html` 的 class，两套同名 oklch 变量 | `src/app.tsx`、`src/globals.css` |
| 中英双语 | `I18nProvider` 字典 + `srp_lang` 本地存储 | `src/lib/i18n.tsx` |
| 移动优先瀑布流 | 1 列 → 2 列（`min-[360px]`）→ 3 列（`md`）→ 4 列（`lg`，`gif` 为 5 列） | `src/components/image-gallery.tsx` |
| 图库为主角 | 画廊页 `max-w-7xl`，其余页 `max-w-4xl`～`max-w-6xl`；卡片留白让位给图片 | `src/pages/gallery.tsx`、`src/pages/home.tsx` |
| 界面克制 | 强调色只有 `--primary`（反相黑白）；分隔靠 `border`；阴影最浅一档只给卡片，浮层与浮起态才加深 | `src/globals.css`、`src/components/navbar.tsx` |

## 页面骨架

| 路由 | 入口 HTML | 页面组件 | `<main>` 容器 | 自上而下区块 |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `index.html` | `src/pages/home.tsx` | `container mx-auto px-4 max-w-5xl`（hero）/ `max-w-4xl` / `max-w-6xl` | Hero → 在线实时体验（`LivePreview`）→ 分类看板 → 特性矩阵 |
| `/gallery` | `gallery.html` | `src/pages/gallery.tsx` | `container mx-auto min-w-0 px-4 py-8 max-w-7xl` | 标题 + 分类 Tab → `ImageGallery` |
| `/settings` | `settings.html` | `src/pages/settings.tsx` | `container mx-auto px-4 py-8 sm:py-10 max-w-6xl` | 标题 → `ApiPanel defaultOpen` → UA 分流说明 |

三页外壳一致：`min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300`，`Navbar` 在前、`Footer` 在后，`main` 带 `id="main-content"` 供 skip-link 跳转（`src/pages/home.tsx`、`src/pages/gallery.tsx`、`src/pages/settings.tsx`）。

## 视觉原则

1. **只用 token，不写死颜色。** 任何颜色都应能追到 `src/globals.css` 里的 CSS 变量；细节见 [tokens.md](./tokens.md)。
2. **一个强调色。** `--primary` 在亮色下是近黑、暗色下是近白，主按钮、选中态、链接用它；成功/警告/危险才引入 `emerald`/`amber`/`rose` 与 `--destructive`（`src/components/live-preview.tsx`、`src/components/api-panel.tsx`）。
3. **层级用边框表达。** 卡片普遍是 `border border-border` + `bg-card`，阴影仅出现在浮层与浮起状态（`bg-card/75 shadow-xs`、`.site-header[data-scrolled="true"]` 的 `box-shadow`）。
4. **正文中性、代码等宽。** 路径、后缀、域名一律 `font-mono`（`src/components/api-panel.tsx`）。
5. **图标是装饰。** 所有 lucide 图标带 `aria-hidden="true"`，语义由相邻文本或 `aria-label` 承担（`src/components/navbar.tsx`）。
6. **动效解释空间关系，不做入场表演。** 详见 [motion.md](./motion.md)。

## 不变量

| 不变量 | 含义 | 出处 |
| :--- | :--- | :--- |
| 三页外壳一致 | 都是 `min-h-screen flex flex-col` + `Navbar` + `main#main-content` + `Footer` | `src/pages/*.tsx` |
| 顶栏常驻 | `sticky top-2 sm:top-4`，任何时候都在文档流里，靠 `data-retracted` 让位 | `src/components/navbar.tsx` |
| 宽度上限 | 正文最宽 `max-w-7xl`，长文页更窄；不出现全宽无留白段落 | `src/pages/gallery.tsx`、`src/pages/settings.tsx` |
| 颜色来自 token | 组件里不出现裸色值 | `src/globals.css` |
| 文案来自字典 | 组件里不出现中英混排的字面量 | `src/lib/i18n.tsx` |
| 动效上限 | 单次过渡不超过 `300ms` | [motion.md](./motion.md) |

## 边界

- 构建产物如何装配到 `dist/`：见 [../architecture/build-pipeline.md](../architecture/build-pipeline.md)。
- 本地命令与测试：见 [../development/README.md](../development/README.md)。
- 接口返回什么：见 [../reference/api.md](../reference/api.md)。
- 截图文件本身不作为视觉回归基线，只用于 README 展示，见 [screenshots.md](./screenshots.md)。

## 分册地图

| 文件 | 回答什么问题 | 主要出处 |
| :--- | :--- | :--- |
| [tokens.md](./tokens.md) | 颜色、字体、字号、间距、圆角、主题切换各用哪个 token | `src/globals.css`、`index.html` |
| [components.md](./components.md) | 七个复用组件的用途、props、约束与反例 | `src/components/*.tsx` |
| [motion.md](./motion.md) | 路由过渡、顶栏收敛与回缩、减少动效降级 | `src/globals.css`、`src/components/navbar.tsx` |
| [i18n-accessibility.md](./i18n-accessibility.md) | 双语字典、`document.title`、键盘路径、`aria-*`、`alt` 规则 | `src/lib/i18n.tsx`、`src/lib/gallery-translations.ts` |
| [screenshots.md](./screenshots.md) | 四张 README 截图展示什么、怎么再生成 | `docs/screenshots/*.webp`、`README.md` |

## 改 UI 前后的检查

- 新颜色是否有 var？没有就加到 `:root` 与 `.dark` 两处，再到 `@theme inline` 补 `--color-*`（`src/globals.css`）。
- 新组件是否复用 `Navbar`/`Footer` 外壳，而不是另起 `<header>`（`src/pages/*.tsx`）。
- 交互元素是否可键盘到达、可聚焦时可见（全局 `:focus-visible` 已给 2px `--ring` 描边，`src/globals.css`）。
- 新文案是否同时进了 `TRANSLATIONS.zh` 与 `TRANSLATIONS.en`（`src/lib/i18n.tsx`）。
- 新增动画是否只动 `transform`/`opacity`，并在 `prefers-reduced-motion` 下退化（[motion.md](./motion.md)）。

## 待确认

- 仓库内没有设计稿或 Figma 链接，本分册全部由源码归纳；"原始设计意图"无法从仓库验证。
- `--chart-*` 与 `--sidebar-*` 两组变量在 `src/` 中无引用，保留原因待确认。
- 颜色对比度没有自动化测试（`tests/` 下无 axe/对比度用例），验收依赖人工。
