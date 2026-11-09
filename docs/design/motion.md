# 动效

动效只做三件事：页面切换时提示"内容换了"、顶栏在滚动中让位、浮层展开/收起。没有滚动视差、没有入场逐项动画。

## 时间常数

| 用途 | 时长与曲线 | 出处 |
| :--- | :--- | :--- |
| 路由淡入（页面） | `180ms ease-out both` | `.route-enter main`，`src/globals.css` |
| 路由淡入（画廊） | `140ms ease-out both` | `.gallery-enter`，`src/globals.css` |
| 顶栏整体回缩 | `transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)` | `.site-header`，`src/globals.css` |
| 胶囊几何（`margin-inline`/`padding`） | `0.3s` 同上曲线 | `.site-header-capsule`、`.site-header-brand`、`.site-header-cluster` |
| 胶囊观感（`border-color`/背景/`box-shadow`/`backdrop-filter`） | `0.2s ease` | `.site-header-capsule` |
| 移动抽屉 | 行高 `0.3s` + 透明度 `0.25s` + `visibility 0s`（关闭时延迟 `0.3s`） | `.site-header-panel` |
| 图片淡入 | `opacity 200ms` | `src/components/image-gallery.tsx` |
| 面板展开 | `grid-template-rows, opacity 300ms ease-out` | `src/components/api-panel.tsx` |
| 颜色/描边过渡 | `150ms`～`300ms`（`transition-colors`） | `src/pages/*.tsx`、`src/components/navbar.tsx` |

## 路由过渡

- `RouteTransition` 以 `key={pathname}` 重挂载子树，动画因此在每次路径变化时重放；`/gallery` 内部切分类不会触发（`src/app.tsx`）。
- 关键帧 `route-reveal` 只改 `opacity`：`0.55 → 1`，不做位移与缩放，避免正文在切换瞬间"移动"（`src/globals.css`）。
- 画廊整体再叠一层 `.gallery-enter`，比页面淡入更短，因为首屏已有骨架占位（`src/components/image-gallery.tsx`）。
- 约束：新页面不要再加独立的入场动画；需要强调时用 `transition-colors` 之类的局部过渡。

## 顶栏三态

`<header>` 上三个 data 属性驱动全部状态，CSS 与 JS 的分工是固定的（`src/components/navbar.tsx`、`src/globals.css`）。

| 属性 | 触发条件 | 视觉结果 |
| :--- | :--- | :--- |
| `data-scrolled` | `window.scrollY > 20`（`MORPH_AT`） | 胶囊获得描边、`color-mix` 半透明底、`backdrop-filter: blur(20px)`、`padding-inline: 0.875rem`、双层投影；品牌左移 `0.25rem`，控件簇间距收窄到 `0.375rem` |
| `data-retracted` | `scrollY > 350`（`HIDE_AFTER`）且本次滚动向下 | `translateY(-5.5rem)`，整条顶栏滑出视口 |
| `data-menu="open"` | 移动抽屉打开 | 复用 `data-scrolled` 的胶囊样式，并展开面板 |

- `800px` 断点以上，胶囊在 `data-scrolled` 时额外 `margin-inline: 8%`（相对 `max-w-6xl` 容器），窄屏不动，避免手机上把可用宽度吃掉（`src/globals.css`）。
- 回缩是"手势"而不是"阈值状态"：比较 `y > lastY`，向上滚立即复位；`lastY` 每次滚动都更新（`src/components/navbar.tsx`）。
- 抽屉打开期间、或系统开启减少动效时，`setRetracted(false)` 强制常显（`src/components/navbar.tsx`）。
- 约束：新增态只能加 `data-*` 属性并在 CSS 里消费，不要在 React 里算行内 `style.transform`。

## 移动抽屉

- 容器用 `grid-template-rows: 0fr → 1fr` 展开，内层 `min-height: 0; overflow: hidden` 才能被压缩到零高（`src/globals.css`、`src/components/navbar.tsx`）。
- 关闭时 `visibility` 延迟 `0.3s` 生效，保证收起动画期间仍可见；打开时 `visibility` 立即生效（`src/globals.css`）。
- 同一时刻 `inert={!mobileMenuOpen}`，关闭后抽屉内链接不可聚焦（`src/components/navbar.tsx`）。

## 减少动效

| 层面 | 做法 | 出处 |
| :--- | :--- | :--- |
| 全局 | `prefers-reduced-motion: reduce` 下把所有 `animation-duration`/`transition-duration` 压到 `0.01ms`、`animation-iteration-count: 1`、`scroll-behavior: auto` | `src/globals.css` |
| 顶栏 | 减少动效时不回缩，只保留 `data-scrolled` 的形态变化 | `src/components/navbar.tsx` |
| 画廊骨架 | `animate-pulse motion-reduce:animate-none` | `src/components/image-gallery.tsx` |
| 图片与按钮过渡 | `motion-reduce:transition-none` | `src/components/image-gallery.tsx` |
| 面板展开 | `motion-reduce:transition-none` | `src/components/api-panel.tsx` |
| 回到顶部 | 减少动效时用 `behavior: "instant"` 而不是平滑滚动 | `src/components/image-gallery.tsx` |
| 页脚回顶 | 固定 `behavior: "smooth"`，依赖全局降级兜底 | `src/components/footer.tsx` |

## 约束

- **只动 `transform` 与 `opacity`。** 路由淡入、顶栏回缩、悬停位移都遵守这条；`grid-template-rows`（抽屉、`ApiPanel`）与胶囊的 `padding`/`margin-inline` 是有意的例外，时长都压在 `300ms` 以内，且不涉及整页重排（`src/globals.css`、`src/components/api-panel.tsx`）。
- 交互反馈优先用 `transition-colors`，不要给每个 hover 都加位移（`src/components/navbar.tsx`、`src/pages/home.tsx`）。
- 滚动监听必须 `{ passive: true }`，回缩判断放在同一个 handler 里，避免多个 scroll 回调（`src/components/navbar.tsx`）。
- Fancybox 的过渡没有自定义，使用库默认行为（`src/components/image-gallery.tsx`）。

## `disableTransitionOnChange`

`ThemeProvider` 开启了 `disableTransitionOnChange`（`src/app.tsx`）。原因：`.dark` 一次性替换全部颜色变量，页面上大量元素带 `transition-colors duration-300`，若不屏蔽，切主题会变成整页 `300ms` 渐变，出现中间态灰阶与闪烁。

代价与规则：

- 切主题瞬间所有过渡被禁用，包括本该保留的 hover 过渡；这是可接受的取舍。
- 因此**不要依赖 `transition-colors` 表达状态机**（例如"切入暗色后延迟高亮"），切换瞬间的过渡不可靠。
- 主题持久化与首帧写入由 `next-themes` 与 `index.html` 内联脚本负责，细节见 [tokens.md](./tokens.md)。
