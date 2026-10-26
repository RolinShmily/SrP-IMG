"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore, useId } from "react";
import { useI18n } from "@/lib/i18n";
import { API_TRANSLATIONS } from "@/lib/api-translations";
import {
  Terminal,
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Smartphone,
  Monitor,
  User,
  Film,
  Zap,
  Info,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

export type CopyFormat = "url" | "markdown" | "html";

export interface ApiItem {
  id: string;
  name: string;
  category: "query" | "direct";
  path: string;
  description: string;
  badge: string;
  aspectHint: string;
  ext?: string;
  catKey?: string;
  icon: typeof Terminal;
}

const CATEGORY_ICONS: Record<string, typeof Terminal> = {
  h: Monitor,
  v: Smartphone,
  a: User,
  gif: Film,
};

const CATEGORY_HINTS: Record<string, string> = {
  h: "4:3 / 16:9",
  v: "9:16",
  a: "1:1",
};

const BASE_DEFAULT_CATEGORIES: Record<string, string> = {
  h: ".jpg",
  v: ".jpg",
  a: ".jpeg",
  gif: ".gif",
};

function formatOutput(origin: string, path: string, format: CopyFormat, alt: string): string {
  const fullUrl = `${origin}${path}`;
  switch (format) {
    case "url":
      return fullUrl;
    case "markdown":
      return `![${alt}](${fullUrl})`;
    case "html":
      return `<img src="${fullUrl}" alt="${alt}" />`;
  }
}

interface ApiPanelProps {
  defaultOpen?: boolean;
}

export function ApiPanel({ defaultOpen = false }: ApiPanelProps) {
  const { lang } = useI18n();
  const t = API_TRANSLATIONS[lang];
  const panelId = useId();
  const guideId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isCfGuideOpen, setIsCfGuideOpen] = useState(false);
  const origin = useSyncExternalStore(
    () => () => {},
    () => (typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://img.srprolin.com"),
    () => "https://img.srprolin.com"
  );

  const hostname = useSyncExternalStore(
    () => () => {},
    () => (typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "img.srprolin.com"),
    () => "img.srprolin.com"
  );

  const [categoryExts, setCategoryExts] = useState<Record<string, string>>(BASE_DEFAULT_CATEGORIES);
  const [serverCategories, setServerCategories] = useState<{
    key: string;
    name_zh?: string;
    name_en?: string;
    aspect_hint?: string;
    ext?: string;
  }[]>([]);
  const [previewFormat, setPreviewFormat] = useState<CopyFormat>("url");
  const [filterCategory, setFilterCategory] = useState<"all" | "query" | "direct">("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"copying" | "success" | "error" | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const copyRequestRef = useRef(0);

  // 动态从 counts.json 加载全部分类与后缀
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const res = await fetch("/counts.json");
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        if (data.category_exts && typeof data.category_exts === "object") {
          setCategoryExts(data.category_exts);
        }
        if (Array.isArray(data.categories)) {
          setServerCategories(data.categories);
        }
      } catch (err) {
        console.warn("ApiPanel: counts.json not loaded yet, using fallback", err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopy = useCallback(async (text: string, key: string) => {
    const request = ++copyRequestRef.current;
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    setCopiedKey(null);
    setCopyStatus("copying");

    let success = false;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (error) {
        // Permission or secure-context restrictions can require the legacy fallback.
        console.warn("Clipboard API unavailable; trying legacy copy", error);
      }
    }
    if (!mountedRef.current || request !== copyRequestRef.current) return;

    if (!success && typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      const previousFocus = document.activeElement;
      try {
        textarea.value = text;
        textarea.readOnly = true;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand("copy");
      } catch (error) {
        console.error("Clipboard copy failed:", error);
      } finally {
        textarea.remove();
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
          previousFocus.focus({ preventScroll: true });
        }
      }
    }

    if (!mountedRef.current || request !== copyRequestRef.current) return;
    setCopyStatus(success ? "success" : "error");
    if (success) {
      setCopiedKey(key);
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedKey(null);
        setCopyStatus(null);
        copyTimeoutRef.current = null;
      }, 2000);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      copyRequestRef.current += 1;
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const getCategoryLabel = (key: string) => {
    const meta = serverCategories.find((category) => category.key === key);
    return (lang === "en" ? meta?.name_en?.trim() : meta?.name_zh?.trim())
      || t.categoryNames[key] || t.categoryName(key);
  };

  const getAspectHint = (key: string) => {
    const hint = serverCategories.find((category) => category.key === key)?.aspect_hint?.trim();
    if (hint === "动态格式" || hint === "Animated") return t.animated;
    if (hint === "自适应" || hint === "Adaptive") return t.adaptive;
    if (hint === "暂无素材" || hint === "No images yet") return t.noImages;
    // Metadata can contain Chinese-only custom hints; keep English UI localized.
    if (hint && (lang === "zh" || !/\p{Script=Han}/u.test(hint))) return hint;
    return CATEGORY_HINTS[key] || (key === "gif" ? t.animated : t.adaptive);
  };

  // 动态生成接口列表：支持已有和新增的任意分类
  const endpoints: ApiItem[] = [];
  const keys = Object.keys(categoryExts).sort((a, b) => {
    const order = ["h", "v", "a", "gif"];
    const idxA = order.indexOf(a);
    const idxB = order.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // 1. 标准 302 重定向 API
  keys.forEach((key) => {
    const label = getCategoryLabel(key);
    const icon = CATEGORY_ICONS[key] || Sparkles;
    const aspect = getAspectHint(key);
    endpoints.push({
      id: `pic-${key}`,
      name: `${label} API`,
      category: "query",
      catKey: key,
      ext: categoryExts[key],
      path: `/pic?img=${key}`,
      description: t.queryDescription(label, categoryExts[key]),
      badge: t.queryBadge,
      aspectHint: aspect,
      icon,
    });
  });

  // 设备智能分流（保留）
  if (categoryExts.h && categoryExts.v) {
    endpoints.push({
      id: "pic-ua",
      name: t.uaName,
      category: "query",
      path: "/pic?img=ua",
      description: t.uaDescription,
      badge: t.uaBadge,
      aspectHint: t.adaptive,
      icon: Sparkles,
    });
  }

  // 2. 极简无感直链 (需边缘重写)
  keys.forEach((key) => {
    const label = getCategoryLabel(key);
    const icon = Zap;
    const aspect = getAspectHint(key);
    endpoints.push({
      id: `direct-${key}`,
      name: t.directName(label),
      category: "direct",
      catKey: key,
      ext: categoryExts[key],
      path: `/${key}`,
      description: t.directDescription,
      badge: t.directBadge,
      aspectHint: aspect,
      icon,
    });
  });

  const filteredEndpoints = endpoints.filter((item) => {
    if (filterCategory === "all") return true;
    return item.category === filterCategory;
  });

  return (
    <section className="mb-8 min-w-0 max-w-full rounded-2xl border border-border bg-card/75 shadow-xs overflow-hidden [overflow-wrap:anywhere]">
      <h2>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((prev) => !prev)}
          className="group w-full px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-left cursor-pointer hover:bg-muted/40 transition-colors select-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
              <Terminal className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm sm:text-base text-foreground tracking-tight">{t.title}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{t.dualMode}</span>
              </span>
              <span className="text-xs text-muted-foreground hidden sm:block">{t.subtitle}</span>
            </span>
          </span>
          {!isOpen && (
            <span className="hidden lg:flex flex-wrap items-center gap-1.5 text-xs font-mono text-muted-foreground" aria-hidden="true">
              <span className="px-2 py-0.5 rounded bg-muted">/pic?img=h</span>
              <span className="px-2 py-0.5 rounded bg-muted">/pic?img=v</span>
              <span className="px-2 py-0.5 rounded bg-muted">/pic?img=a</span>
              <span className="px-2 py-0.5 rounded bg-muted">/h</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground">
            <span>{isOpen ? t.collapse : t.expand}</span>
            {isOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          </span>
        </button>
      </h2>
      <div role="status" aria-live="polite" aria-atomic="true" className={copyStatus ? `px-4 sm:px-6 py-2 text-xs ${copyStatus === "error" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}` : "sr-only"}>
        {copyStatus === "copying" ? t.copying : copyStatus === "success" ? t.copied : copyStatus === "error" ? t.copyError : ""}
      </div>

      <div
        id={panelId}
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`grid min-w-0 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 min-w-0 overflow-hidden">
        <div className="border-t border-border/60 p-4 sm:p-6 space-y-5">
          {/* 控制工具条：当前域名、分类过滤、复制格式预设 */}
          <div className="flex min-w-0 flex-col md:items-start justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
            {/* 当前域名指示 */}
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-muted-foreground">
              <span className="font-medium text-foreground">{t.baseDomain}:</span>
              <code className="min-w-0 max-w-full break-all px-2 py-0.5 rounded bg-background border border-border font-mono text-foreground">
                {origin}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(origin, "base-origin")}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title={t.copyDomain}
              >
                {copiedKey === "base-origin" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{t.copy}</span>
                  </>
                )}
              </button>
            </div>

            {/* 格式切换与分类筛选 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 分类筛选 */}
              <div role="group" aria-label={t.filterLabel} className="flex max-w-full flex-wrap items-center rounded-lg bg-background p-0.5 border border-border">
                <button
                  type="button"
                  aria-pressed={filterCategory === "all"}
                  onClick={() => setFilterCategory("all")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    filterCategory === "all"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.all} ({endpoints.length})
                </button>
                <button
                  type="button"
                  aria-pressed={filterCategory === "query"}
                  onClick={() => setFilterCategory("query")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    filterCategory === "query"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.queryTab}
                </button>
                <button
                  type="button"
                  aria-pressed={filterCategory === "direct"}
                  onClick={() => setFilterCategory("direct")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    filterCategory === "direct"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.directTab}
                </button>
              </div>

              {/* 格式预览切换 */}
              <div role="group" aria-label={t.formatLabel} className="flex max-w-full flex-wrap items-center rounded-lg bg-background p-0.5 border border-border">
                <button
                  type="button"
                  aria-pressed={previewFormat === "url"}
                  onClick={() => setPreviewFormat("url")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    previewFormat === "url"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.urlFormat}
                </button>
                <button
                  type="button"
                  aria-pressed={previewFormat === "markdown"}
                  onClick={() => setPreviewFormat("markdown")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    previewFormat === "markdown"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.markdown}
                </button>
                <button
                  type="button"
                  aria-pressed={previewFormat === "html"}
                  onClick={() => setPreviewFormat("html")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    previewFormat === "html"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.html}
                </button>
              </div>
            </div>
          </div>

          {/* 模式区别提示横幅 */}
          {filterCategory === "query" && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/70 border border-border/80 text-xs text-foreground/90">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <span className="font-semibold">{t.queryTitle}</span>
                {t.queryBanner}
              </div>
            </div>
          )}

          {filterCategory === "direct" && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              <SlidersHorizontal className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold">{t.directTitle}</span>
                {t.directBanner}
              </div>
            </div>
          )}

          {/* 接口卡片网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredEndpoints.map((item) => {
              const IconComponent = item.icon;
              const directUrl = `${origin}${item.path}`;
              const currentPreviewText = formatOutput(origin, item.path, previewFormat, t.randomImage);

              const isUrlCopied = copiedKey === `${item.id}-url`;
              const isMarkdownCopied = copiedKey === `${item.id}-markdown`;
              const isHtmlCopied = copiedKey === `${item.id}-html`;
              const isCodeBoxCopied = copiedKey === `${item.id}-preview`;

              return (
                <div
                  key={item.id}
                  className="min-w-0 rounded-xl border border-border/80 bg-background/50 hover:bg-background/90 p-4 transition-colors duration-200 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs group"
                >
                  {/* 卡片头部 */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="p-1 rounded bg-muted text-foreground">
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-sm text-foreground">
                          {item.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          item.category === 'direct'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {item.badge}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {item.aspectHint}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* 格式化代码预览盒 */}
                  <div className="relative min-w-0 group/box">
                    <button
                      type="button"
                      onClick={() => handleCopy(currentPreviewText, `${item.id}-preview`)}
                      className="block w-full min-w-0 max-w-full p-2.5 rounded-lg bg-muted/60 hover:bg-muted/90 text-left text-[11px] font-mono text-foreground/90 whitespace-pre-wrap break-all border border-border/60 transition-colors cursor-pointer select-all focus-visible:outline-2 focus-visible:outline-primary"
                      title={t.copyPreview}
                      aria-label={`${t.copyPreview}: ${item.name}`}
                    >
                      <code>{currentPreviewText}</code>
                    </button>
                    <div aria-hidden="true" className="absolute right-2 top-2 pointer-events-none opacity-0 group-hover/box:opacity-100 group-focus-within/box:opacity-100 transition-opacity text-[10px] bg-background/90 text-foreground px-1.5 py-0.5 rounded shadow-2xs">
                      {isCodeBoxCopied ? t.copied : t.clickCopy}
                    </div>
                  </div>

                  {/* 底部按钮栏：URL, MD, HTML, 测试 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* 复制 URL */}
                      <button
                        type="button"
                        onClick={() => handleCopy(directUrl, `${item.id}-url`)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                          isUrlCopied
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                        title={t.copyUrl}
                        aria-label={`${t.copyUrl}: ${item.name}`}
                      >
                        {isUrlCopied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span>{isUrlCopied ? t.copied : t.url}</span>
                      </button>

                      {/* 复制 Markdown */}
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            formatOutput(origin, item.path, "markdown", t.randomImage),
                            `${item.id}-markdown`
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                          isMarkdownCopied
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                        title={t.copyMarkdown}
                        aria-label={`${t.copyMarkdown}: ${item.name}`}
                      >
                        {isMarkdownCopied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Code className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span>{isMarkdownCopied ? t.copied : t.md}</span>
                      </button>

                      {/* 复制 HTML */}
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            formatOutput(origin, item.path, "html", t.randomImage),
                            `${item.id}-html`
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                          isHtmlCopied
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                        title={t.copyHtml}
                        aria-label={`${t.copyHtml}: ${item.name}`}
                      >
                        {isHtmlCopied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Code className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span>{isHtmlCopied ? t.copied : t.html}</span>
                      </button>
                    </div>

                    {/* 在线测试链接 */}
                    <a
                      href={directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={t.testTitle}
                      aria-label={`${t.testTitle}: ${item.name}`}
                    >
                      <span>{t.test}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 专栏板块：Cloudflare 边缘重写配置指南与防冲突规则生成器 */}
          <div className="mt-6 rounded-xl border border-border/80 bg-background/60 p-4 sm:p-5 space-y-4">
            <h3>
              <button
                type="button"
                aria-expanded={isCfGuideOpen}
                aria-controls={guideId}
                onClick={() => setIsCfGuideOpen((prev) => !prev)}
                className="flex w-full flex-wrap items-center justify-between gap-3 text-left cursor-pointer group select-none rounded focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="shrink-0 p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Layers className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-foreground flex flex-wrap items-center gap-2">
                      {t.cfTitle}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-normal">{t.cfTag}</span>
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">{t.cfDescription}</span>
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  <span>{isCfGuideOpen ? t.cfCollapse : t.cfExpand}</span>
                  {isCfGuideOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                </span>
              </button>
            </h3>

            <div
              id={guideId}
              aria-hidden={!isCfGuideOpen}
              inert={!isCfGuideOpen}
              className={`grid min-w-0 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${isCfGuideOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="min-h-0 min-w-0 overflow-hidden">
              <div className="pt-3 border-t border-border/50 space-y-4 text-xs">
                {/* 核心原理与防打架说明 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.rule1Title}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      {t.rule1Description}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.rule2Title}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      {t.rule2Description}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.rule3Title}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      {t.rule3Description}
                    </p>
                  </div>
                </div>

                {/* 各分类规则速查生成器 */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground flex flex-wrap items-center justify-between gap-2">
                    <span>{t.currentRulesTitle}</span>
                    <span className="text-[11px] text-muted-foreground font-normal">{t.dynamicNote}</span>
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">{t.ruleCaveat}</p>

                  <div className="space-y-2.5">
                    {keys.map((catKey) => {
                      const ext = categoryExts[catKey];
                      const label = getCategoryLabel(catKey);
                      const matchExpr = `(http.host eq "${hostname}" and (http.request.uri.path eq "/${catKey}" or starts_with(http.request.uri.path, "/${catKey}/")) and not ends_with(http.request.uri.path, "${ext}"))`;
                      const rewriteExpr = `concat("/${catKey}/", substring(uuidv4(cf.random_seed), 0, 2), "${ext}")`;

                      const isMatchCopied = copiedKey === `cf-match-${catKey}`;
                      const isRewriteCopied = copiedKey === `cf-rewrite-${catKey}`;

                      return (
                        <div
                          key={`cf-rule-${catKey}`}
                          className="p-3 rounded-lg bg-background border border-border/80 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="min-w-0 font-semibold text-foreground flex flex-wrap items-center gap-2">
                              <span>{t.category}: {label} (<code className="font-mono break-all">/{catKey}</code>)</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                {t.extSuffix}: {ext}
                              </span>
                            </span>
                          </div>

                          {/* 匹配表达式 */}
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span>{t.matchLabel}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(matchExpr, `cf-match-${catKey}`)}
                                className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                              >
                                {isMatchCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                <span>{isMatchCopied ? t.copiedMatch : t.copyMatch}</span>
                              </button>
                            </div>
                            <pre className="max-w-full p-2 rounded bg-muted/60 text-[11px] font-mono text-foreground whitespace-pre-wrap break-all select-all">
                              <code>{matchExpr}</code>
                            </pre>
                          </div>

                          {/* 路径重写表达式 */}
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span>{t.rewriteLabel}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(rewriteExpr, `cf-rewrite-${catKey}`)}
                                className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                              >
                                {isRewriteCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                <span>{isRewriteCopied ? t.copiedRewrite : t.copyRewrite}</span>
                              </button>
                            </div>
                            <pre className="max-w-full p-2 rounded bg-muted/60 text-[11px] font-mono text-foreground whitespace-pre-wrap break-all select-all">
                              <code>{rewriteExpr}</code>
                            </pre>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
