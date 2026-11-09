# 双语与可达性

一套字典 + 一个 `<html lang>` + 一组 `aria-*` 约定。任何新增文案或交互都要同时满足这三件事。

## 字典结构

| 位置 | 内容 | 出处 |
| :--- | :--- | :--- |
| `Language` | `"zh" \| "en"` | `src/lib/i18n.tsx` |
| `Translations` | `meta`、`nav`、`home`、`gallery`、`settings`、`categories`、`footer` 七个分区 | `src/lib/i18n.tsx` |
| `TRANSLATIONS` | `Record<Language, Translations>`，中英各一份，键必须对齐 | `src/lib/i18n.tsx` |
| `I18nProvider` | 提供 `{ lang, setLang, t }`；`t` 缺失时回落 `TRANSLATIONS.zh` | `src/lib/i18n.tsx` |
| `GALLERY_MESSAGES` | 画廊专属文案，含 `(id)`/`(count)` 形式的函数，处理复数与序数 | `src/lib/gallery-translations.ts` |
| `API_TRANSLATIONS` | `ApiPanel` 专属文案，含 `categoryName(key)` 等函数 | `src/lib/api-translations.ts` |

拆成三份的原因：`i18n.tsx` 只装通用骨架文案，画廊与 API 面板的文案带参数（`#12`、数量），放主字典会让 `Translations` 接口膨胀（`src/lib/gallery-translations.ts`、`src/lib/api-translations.ts`）。

## 语言状态

| 环节 | 行为 | 出处 |
| :--- | :--- | :--- |
| 持久化键 | `localStorage["srp_lang"]`，只接受 `"zh"`/`"en"` | `src/lib/i18n.tsx` |
| 读取顺序 | `srp_lang` → 本标签页内存值 `sessionLanguage` → `navigator.language` 以 `en` 开头则 `en` → 否则 `zh` | `src/lib/i18n.tsx` |
| 跨标签同步 | 订阅 `window` 的 `storage` 事件 | `src/lib/i18n.tsx` |
| 同标签刷新 | `setLang` 写存储后手动 `dispatchEvent(new Event("storage"))` | `src/lib/i18n.tsx` |
| 写入失败 | `try/catch` 吞掉配额/隐私模式异常，仅保留当前标签页偏好 | `src/lib/i18n.tsx` |
| 服务端快照 | `getServerSnapshot()` 固定返回 `zh` | `src/lib/i18n.tsx` |

## 标题与文档级副作用

`I18nProvider` 在 `[lang, pathname]` 变化时统一执行（`src/lib/i18n.tsx`）：

| 目标 | 规则 |
| :--- | :--- |
| `document.documentElement.lang` | 中文 `zh-CN`，英文 `en` |
| `document.title` | 有页面名时 `` `${pageName} · ${title}` ``，否则 `title` |
| `pageName` | `/gallery` → `nav.gallery`、`/settings` → `nav.settings`、其余（含首页）→ 空串 |
| `meta[name="description"]` | 写入 `meta.description` |

于是实际标题是 `画廊 · SrP-IMG — 随机图片 API 与画廊`、`API · SrP-IMG — 随机图片 API 与画廊`，首页只有 `meta.title`；三个入口 HTML 的静态 `<title>` 与此一致，客户端挂载后不会跳变（`index.html`、`gallery.html`、`settings.html`）。

约束：标题、`lang`、`meta` 只允许在 `I18nProvider` 里写；组件内不要 `document.title = ...`。

## 键盘可达

| 路径 | 行为 | 出处 |
| :--- | :--- | :--- |
| skip-link | `<header>` 内第一个可聚焦元素，`#main-content` 为目标；默认 `clip-path: inset(50%)`，`focus` 时去掉裁切 | `src/components/navbar.tsx`、`src/globals.css` |
| 焦点环 | 全局 `:where(a, button, input, textarea, select, [tabindex]):focus-visible` 给 `2px solid var(--ring)` + `offset 3px` | `src/globals.css` |
| 移动抽屉 | 关闭时 `inert`，焦点不会落进隐藏面板 | `src/components/navbar.tsx` |
| 分类切换 | 画廊 Tab 与 `LivePreview` 分类均为原生 `button`，`aria-pressed` 表达选中 | `src/pages/gallery.tsx`、`src/components/live-preview.tsx` |
| 图库卡片 | 图片链接可聚焦，`focus-visible` 有描边；复制按钮在 `group-focus-within`/`focus-visible` 时显形 | `src/components/image-gallery.tsx` |
| Fancybox | `placeFocusBack: true` 关闭后焦点回到触发图；键盘 `PageUp → prev`、`PageDown → next`（覆盖 v6 默认反向） | `src/components/image-gallery.tsx` |
| 回到顶部 | 原生按钮，`aria-label` 来自 `GALLERY_MESSAGES.scrollTop` | `src/components/image-gallery.tsx` |
| 平滑滚动降级 | 减少动效时 `behavior: "instant"` | `src/components/image-gallery.tsx` |

## `aria-*` 约定

| 属性 | 用在哪 | 出处 |
| :--- | :--- | :--- |
| `aria-current="page"` | 顶栏当前路由链接（桌面与抽屉各一份） | `src/components/navbar.tsx` |
| `aria-pressed` | 画廊分类、API 过滤、复制格式、`LivePreview` 分类 | `src/pages/gallery.tsx`、`src/components/api-panel.tsx` |
| `aria-expanded` + `aria-controls` | 汉堡按钮 → `#mobile-navigation-panel`；`ApiPanel` 触发器 → `useId()` 面板 | `src/components/navbar.tsx`、`src/components/api-panel.tsx` |
| `aria-live="polite"` / `role="status"` | 复制结果播报、`LivePreview` 加载与复制状态、分页区 | `src/components/image-gallery.tsx`、`src/components/api-panel.tsx` |
| `role="alert"` | 画廊元数据加载失败 | `src/components/image-gallery.tsx` |
| `aria-busy` | `LivePreview` 舞台 | `src/components/live-preview.tsx` |
| `aria-hidden="true"` | 全部装饰图标、下划线圆点、`·` 分隔符 | `src/components/*.tsx`、`src/pages/*.tsx` |
| `inert` | 关闭的移动抽屉与 `ApiPanel` 面板 | `src/components/navbar.tsx`、`src/components/api-panel.tsx` |

状态播报必须是 `sr-only` 段落而不是 `alert()`；视觉反馈（按钮变"已复制"）与播报（`aria-live`）同时给（`src/components/image-gallery.tsx`）。

## 图片文本替代

| 场景 | 写法 | 出处 |
| :--- | :--- | :--- |
| 顶栏品牌图 | `alt=""`，名称由相邻文字 `SrP-IMG` 承担 | `src/components/navbar.tsx` |
| 页脚品牌图 | `alt="SrP-IMG Logo"` | `src/components/footer.tsx` |
| 画廊缩略图 | `messages.imageAlt(id)` → `图库图片 #12` / `Gallery image #12` | `src/lib/gallery-translations.ts` |
| 画廊链接 | `aria-label={messages.previewLabel(id)}` → `预览图片 #12` | `src/lib/gallery-translations.ts` |
| 复制按钮 | `aria-label={messages.copyLabel(id)}`，含图片序号 | `src/lib/gallery-translations.ts` |
| 首页预览图 | `` `${t.home.previewAlt} · ${label}` ``，拼上当前分类名 | `src/components/live-preview.tsx` |
| 失败占位 | `messages.imageUnavailable(id)` | `src/lib/gallery-translations.ts` |

`alt` 是"序号 + 分类"，不是画面描述：`counts.json` 里没有图片描述字段，`ImageGallery` 读取的 `CountsData` 也没有 caption（`src/components/image-gallery.tsx`）。

## 对比度约定

| 组合 | 变量 | 用法 |
| :--- | :--- | :--- |
| 正文 | `--foreground` on `--background` / `--card` | 所有段落与标题 |
| 次要文字 | `--muted-foreground` on `--background` / `--card` | 说明文字、页脚、元数据 |
| 主按钮 | `--primary-foreground` on `--primary` | `换一张`、`进入画廊` |
| 焦点 | `--ring`（亮暗都是 `oklch(0.5 0 0)`） | 全局 `:focus-visible` 描边 |
| 失败 | `--destructive` 或 `text-red-700 dark:text-red-300` | 错误文案 |

约定：文字底色只用 `--background`/`--card`/`--muted` 三档；`--muted-foreground` 不用于长段落；状态色必须成对提供暗色版本（`src/components/api-panel.tsx`、`src/globals.css`）。`tests/` 下没有 axe 或对比度自动化用例，数值达标与否**待确认**，目前依赖人工验收。

## 待确认

- 英文界面里分类名优先取 `counts.json` 的 `name_en`，缺省时才回落字典；`assets/catalog.json` 是否总带英文名，需按 [../reference/generated-files.md](../reference/generated-files.md) 核对实际产物。
- 页脚品牌 `alt` 与相邻文字重复，是既存实现，是否改为 `alt=""` 待确认。
