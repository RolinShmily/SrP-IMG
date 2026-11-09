# 设计 token

颜色、字体、字号、间距、圆角全部来自 `src/globals.css`。写界面时只消费 token，不新增裸值。

## 三层结构

| 层 | 位置 | 形态 | 消费方式 |
| :--- | :--- | :--- | :--- |
| 原始变量 | `:root` / `.dark` | `--background: oklch(...)` | `var(--background)`、任意 CSS |
| 主题映射 | `@theme inline` | `--color-background: var(--background)` | 生成 `bg-background`、`text-background`、`border-background` 等工具类 |
| 组件用法 | `src/**` | Tailwind 类名 | `bg-card/75`、`text-muted-foreground`、`border-border` |

`@theme inline` 是关键的一层：没有它，`bg-background` 这类类名不存在。映射在 `src/globals.css`。

## 颜色 token

两套变量同名、值不同，切换靠 `html.dark`（`src/globals.css`）。

| 变量 | 亮色 | 暗色 | 用途 |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(0.98 0 0)` | `oklch(0.12 0 0)` | 页面底色 |
| `--foreground` | `oklch(0.15 0 0)` | `oklch(0.96 0 0)` | 主文字 |
| `--card` / `--card-foreground` | `oklch(1 0 0)` / `oklch(0.15 0 0)` | `oklch(0.16 0 0)` / `oklch(0.96 0 0)` | 卡片、顶栏胶囊底 |
| `--popover` / `--popover-foreground` | `oklch(1 0 0)` / `oklch(0.15 0 0)` | `oklch(0.16 0 0)` / `oklch(0.96 0 0)` | 浮层；当前 `src/` 未使用 |
| `--primary` / `--primary-foreground` | `oklch(0.15 0 0)` / `oklch(0.98 0 0)` | `oklch(0.96 0 0)` / `oklch(0.12 0 0)` | 主按钮、选中态、强调 |
| `--secondary` / `--secondary-foreground` | `oklch(0.9 0 0)` / `oklch(0.15 0 0)` | `oklch(0.22 0 0)` / `oklch(0.96 0 0)` | 次按钮；当前 `src/` 未使用 |
| `--muted` / `--muted-foreground` | `oklch(0.92 0 0)` / `oklch(0.5 0 0)` | `oklch(0.2 0 0)` / `oklch(0.65 0 0)` | 弱化底、次要文字 |
| `--accent` / `--accent-foreground` | `oklch(0.85 0 0)` / `oklch(0.15 0 0)` | `oklch(0.25 0 0)` / `oklch(0.96 0 0)` | 悬停强调；当前 `src/` 未使用 |
| `--destructive` / `--destructive-foreground` | `oklch(0.577 0.245 27.325)` / `oklch(0.985 0 0)` | `oklch(0.5 0.2 25)` / `oklch(0.96 0 0)` | 失败状态（预览状态点、复制失败文案） |
| `--border` | `oklch(0.88 0 0)` | `oklch(0.25 0 0)` | 所有分隔线、卡片描边 |
| `--input` | `oklch(0.88 0 0)` | `oklch(0.25 0 0)` | 输入框描边；当前 `src/` 未使用 |
| `--ring` | `oklch(0.5 0 0)` | `oklch(0.5 0 0)` | 焦点环 |
| `--chart-1..5` | 多色 | 多色 | 保留位，`src/` 未引用 |
| `--sidebar*` | 灰阶 | 灰阶 | 保留位，`src/` 未引用 |

暗色不是亮色的简单反相：`--background` 压到 `0.12`、`--card` 抬到 `0.16`，卡片靠"比底色亮一点"区分，而不是靠阴影（`src/globals.css`）。

半透明用法只允许在 token 上做，例如 `bg-card/75`、`bg-muted/40`、`border-border/60`（`src/components/api-panel.tsx`）。

## 字体

自托管 Geist 拉丁子集，文件在 `assets/static/fonts/`，经 `publicDir` 发布为 `/fonts/*.woff2`，并由三个 HTML 入口 `preload`（`index.html`、`vite.config.ts`）。

| `@font-face` | 来源 | 关键描述符 | 作用 |
| :--- | :--- | :--- | :--- |
| `Geist` | `/fonts/geist-latin.woff2` | `font-weight: 100 900`、`font-display: swap`、latin `unicode-range` | 正文、标题 |
| `Geist Fallback` | `local(Arial)` | `ascent-override: 95.94%`、`descent-override: 28.16%`、`line-gap-override: 0%`、`size-adjust: 104.76%` | webfont 到达前的度量对齐 |
| `Geist Mono` | `/fonts/geist-mono-latin.woff2` | `font-weight: 100 900`、`font-display: swap` | 路径、后缀、域名、计数 |
| `Geist Mono Fallback` | `local(Arial)` | `ascent-override: 74.67%`、`descent-override: 21.92%`、`line-gap-override: 0%`、`size-adjust: 134.59%` | 同上 |

组合进 `--font-geist-sans` / `--font-geist-mono`，再由 `@theme inline` 暴露为 `--font-sans` / `--font-mono`；sans 的后备链显式包含 `"PingFang SC"`、`"Microsoft YaHei"` 等中文字体（`src/globals.css`）。`body` 通过 `body { @apply bg-background text-foreground }` 与 `<body class="font-sans ...">` 同时落到 Geist（`src/globals.css`、`index.html`）。

## 字号层级

以下均从实际类名归纳，不是新增规范。

| 角色 | 类名 | 出处 |
| :--- | :--- | :--- |
| 首页主标题 | `text-4xl sm:text-6xl font-bold tracking-tight text-balance` | `src/pages/home.tsx` |
| 页面主标题 | `text-3xl sm:text-4xl font-bold tracking-tight` | `src/pages/settings.tsx` |
| 区块标题 | `text-2xl sm:text-3xl font-bold tracking-tight` | `src/pages/home.tsx`、`src/pages/gallery.tsx` |
| 次级区块标题 | `text-xl sm:text-2xl font-bold tracking-tight` | `src/pages/home.tsx` |
| 卡片标题 | `font-semibold text-base` / `text-sm` | `src/pages/home.tsx`、`src/components/api-panel.tsx` |
| 正文 | `text-base sm:text-lg leading-relaxed text-pretty`（hero）/ `text-xs sm:text-sm`（区块说明） | `src/pages/home.tsx` |
| 控件文字 | `text-xs sm:text-sm font-medium` | `src/components/navbar.tsx` |
| 注释与元数据 | `text-[11px]`、`text-[10px]` | `src/components/footer.tsx`、`src/components/api-panel.tsx` |
| 计数与后缀 | `font-mono` + `text-[10px]`/`text-xs` | `src/pages/gallery.tsx`、`src/components/api-panel.tsx` |

字重只用四档：`font-bold`（标题）、`font-semibold`（卡片标题、品牌）、`font-medium`（按钮、导航）、默认 normal（正文）。字距只在标题上用 `tracking-tight`（`src/pages/*.tsx`）。

## 间距节奏

| 场景 | 取值 | 出处 |
| :--- | :--- | :--- |
| 页面横向留白 | `px-4` | 所有 `container` |
| 内容最大宽度 | `max-w-4xl` / `max-w-5xl` / `max-w-6xl` / `max-w-7xl` | 按页面自上而下递增 |
| 区块纵向留白 | `pt-12 pb-16 sm:pt-20 sm:pb-24`（hero）、`py-12 sm:py-16`（其余）、`py-8`（画廊/设置 `main`） | `src/pages/home.tsx`、`src/pages/gallery.tsx` |
| 区块内间距 | `space-y-6`、`space-y-8`、`gap-3 sm:gap-4`、`gap-4` | `src/pages/home.tsx`、`src/components/image-gallery.tsx` |
| 顶栏高度 | `h-14`，`sticky top-2 sm:top-4` | `src/components/navbar.tsx` |
| 卡片内边距 | `p-4`（API 卡片）、`p-5`（分类卡片）、`p-6`（特性卡片） | `src/components/api-panel.tsx`、`src/pages/home.tsx` |
| 网格列数 | 分类 `1/sm:2/lg:4`、特性 `1/md:2`、API `1/md:2/lg:3`、画廊 `1/min-[360px]:2/md:3/lg:4` | 对应文件 |

## 圆角

`--radius: 0.625rem` 是唯一基准，`@theme inline` 派生四档（`src/globals.css`）：

| 类名 | 计算 | 结果 |
| :--- | :--- | :--- |
| `rounded-sm` | `calc(var(--radius) - 4px)` | 6px |
| `rounded-md` | `calc(var(--radius) - 2px)` | 8px |
| `rounded-lg` | `var(--radius)` | 10px |
| `rounded-xl` | `calc(var(--radius) + 4px)` | 14px |

`rounded-2xl`、`rounded-full` 不在仓库覆盖范围内，走 Tailwind 默认值。用法上按钮与导航项用 `rounded-lg`/`rounded-md`，卡片用 `rounded-2xl`，胶囊与徽章用 `rounded-full`（`src/components/navbar.tsx`、`src/pages/home.tsx`）。

## 明暗主题切换

| 环节 | 实现 | 出处 |
| :--- | :--- | :--- |
| 首帧防闪 | `index.html` 内联脚本按 `attribute="class"`、`storageKey="theme"`、`defaultTheme="system"`、`themes=["light","dark"]` 提前写 class，并在 `light`/`dark` 时同步 `style.colorScheme` | `index.html`、`gallery.html`、`settings.html` |
| 运行时 | `ThemeProvider` 透传 `next-themes`，参数 `attribute="class"`、`defaultTheme="system"`、`enableSystem`、`disableTransitionOnChange` | `src/app.tsx`、`src/components/theme-provider.tsx` |
| 变量切换 | `.dark { ... }` 覆盖同名变量；`@custom-variant dark (&:is(.dark *))` 让 `dark:` 前缀按 class 生效 | `src/globals.css` |
| 用户切换 | `ModeToggle` 调 `setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')` | `src/components/mode-toggle.tsx` |

`disableTransitionOnChange` 的作用与代价见 [motion.md](./motion.md)。

## 约束

- 禁止在 `src/` 里写 `#rrggbb`、`rgb()` 或新的 `oklch()`；要新颜色就先加变量，再加 `--color-*` 映射（`src/globals.css`）。
- 已有例外，新增代码不要扩散：`emerald`/`amber`/`rose` 调色板类用于成功与警告文案，`.site-header` 的 `box-shadow` 用了 `hsl(...)`，`color-mix(in srgb, ...)` 用于胶囊半透明底（`src/components/api-panel.tsx`、`src/globals.css`）。
- `--chart-*`、`--sidebar-*` 未映射到组件，不要为它们发明用法。
- 状态色必须以"亮暗双份"出现，例如 `text-emerald-600 dark:text-emerald-400`（`src/components/image-gallery.tsx`）。

## 待确认

- 字号层级是归纳结果，没有设计标注文件可对照。
- 中文正文（`PingFang SC`/`Microsoft YaHei`）与 Geist 的混排度量未做校验，`size-adjust` 只针对拉丁子集。
