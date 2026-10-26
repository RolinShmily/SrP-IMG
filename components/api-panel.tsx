"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
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

const CATEGORY_NAMES: Record<string, string> = {
  h: "横屏",
  v: "竖屏",
  a: "头像",
  gif: "GIF 动图",
};

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
  gif: "动态格式",
};

const BASE_DEFAULT_CATEGORIES: Record<string, string> = {
  h: ".jpg",
  v: ".jpg",
  a: ".jpeg",
  gif: ".gif",
};

function formatOutput(origin: string, path: string, format: CopyFormat): string {
  const fullUrl = `${origin}${path}`;
  switch (format) {
    case "url":
      return fullUrl;
    case "markdown":
      return `![Random Image](${fullUrl})`;
    case "html":
      return `<img src="${fullUrl}" alt="Random Image" />`;
  }
}

interface ApiPanelProps {
  defaultOpen?: boolean;
}

export function ApiPanel({ defaultOpen = false }: ApiPanelProps) {
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
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    let success = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        // fallback
      }
    }

    if (!success && typeof document !== "undefined") {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        success = true;
      } catch (e) {
        console.error("Clipboard copy failed:", e);
      }
    }

    if (success) {
      setCopiedKey(key);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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
    const metaItem = serverCategories.find((c) => c.key === key);
    const label = metaItem?.name_zh || CATEGORY_NAMES[key] || `${key} 分类`;
    const icon = CATEGORY_ICONS[key] || Sparkles;
    const aspect = metaItem?.aspect_hint || CATEGORY_HINTS[key] || "自适应";
    endpoints.push({
      id: `pic-${key}`,
      name: `${label} API`,
      category: "query",
      catKey: key,
      ext: categoryExts[key],
      path: `/pic?img=${key}`,
      description: `302 随机重定向至 ${label} 图片 (${categoryExts[key]})`,
      badge: "即开即用",
      aspectHint: aspect,
      icon,
    });
  });

  // 设备智能分流（保留）
  if (categoryExts.h && categoryExts.v) {
    endpoints.push({
      id: "pic-ua",
      name: "设备智能分流",
      category: "query",
      path: "/pic?img=ua",
      description: "智能识别 User-Agent：手机返回竖屏，PC/平板返回横屏",
      badge: "智能分流",
      aspectHint: "自适应",
      icon: Sparkles,
    });
  }

  // 2. 极简无感直链 (需边缘重写)
  keys.forEach((key) => {
    const metaItem = serverCategories.find((c) => c.key === key);
    const label = metaItem?.name_zh || CATEGORY_NAMES[key] || `${key} 直链`;
    const icon = Zap;
    const aspect = metaItem?.aspect_hint || CATEGORY_HINTS[key] || "自适应";
    endpoints.push({
      id: `direct-${key}`,
      name: `${label}直链`,
      category: "direct",
      catKey: key,
      ext: categoryExts[key],
      path: `/${key}`,
      description: `极简无感路径，直接输出随机图片 (需配置重写规则)`,
      badge: "无感直链",
      aspectHint: aspect,
      icon,
    });
  });

  const filteredEndpoints = endpoints.filter((item) => {
    if (filterCategory === "all") return true;
    return item.category === filterCategory;
  });

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card/75 backdrop-blur-md shadow-xs transition-all duration-300 overflow-hidden">
      {/* 折叠/展开 头部 Bar */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="w-full px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-left cursor-pointer hover:bg-muted/40 transition-colors select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm sm:text-base text-foreground tracking-tight">
                API 调用指南 & 快捷复制
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                双模调用
              </span>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              包含即开即用 302 API、无感边缘直链与防冲突规则生成器
            </p>
          </div>
        </div>

        {/* 快捷药丸标签（折叠状态下展示关键接口预览） */}
        {!isOpen && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-muted">/pic?img=h</span>
            <span className="px-2 py-0.5 rounded bg-muted">/pic?img=v</span>
            <span className="px-2 py-0.5 rounded bg-muted">/pic?img=a</span>
            <span className="px-2 py-0.5 rounded bg-muted">/h</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground">
          <span>{isOpen ? "收起指南" : "展开指南"}</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 transition-transform duration-200" />
          ) : (
            <ChevronDown className="w-4 h-4 transition-transform duration-200" />
          )}
        </div>
      </div>

      {/* 展开内容区域 */}
      {isOpen && (
        <div className="border-t border-border/60 p-4 sm:p-6 space-y-5">
          {/* 控制工具条：当前域名、分类过滤、复制格式预设 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
            {/* 当前域名指示 */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium text-foreground">服务基准域名:</span>
              <code className="px-2 py-0.5 rounded bg-background border border-border font-mono text-foreground">
                {origin}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(origin, "base-origin")}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="复制域名"
              >
                {copiedKey === "base-origin" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>复制</span>
                  </>
                )}
              </button>
            </div>

            {/* 格式切换与分类筛选 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 分类筛选 */}
              <div className="flex items-center rounded-lg bg-background p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setFilterCategory("all")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    filterCategory === "all"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  全部 ({endpoints.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory("query")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    filterCategory === "query"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  即开即用 API
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory("direct")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    filterCategory === "direct"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  无感直链模式
                </button>
              </div>

              {/* 格式预览切换 */}
              <div className="flex items-center rounded-lg bg-background p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewFormat("url")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    previewFormat === "url"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  直接 URL
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFormat("markdown")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    previewFormat === "markdown"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFormat("html")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    previewFormat === "html"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  HTML
                </button>
              </div>
            </div>
          </div>

          {/* 模式区别提示横幅 */}
          {filterCategory === "query" && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/70 border border-border/80 text-xs text-foreground/90">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <span className="font-semibold">【即开即用模式】：</span>
                此模式直接通过 Worker 进行 302 随机重定向，部署完成即 100% 全网可用，无需在 Cloudflare 配置任何规则，完美适配 Markdown、外链博客及各类前端调用。
              </div>
            </div>
          )}

          {filterCategory === "direct" && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              <SlidersHorizontal className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold">【极简无感直链说明】：</span>
                此模式地址保持极简（如 <code className="bg-background/80 px-1 py-0.5 rounded font-mono">/a</code>），在返回图片时<strong>浏览器 URL 始终无痕保持不变</strong>。由于是在 Cloudflare 边缘重写并直接命中静态资产，<strong>完全不消耗 Worker 调用额度（真正 0 成本、无限调用）</strong>。请参考下方规则专栏配置以避免路由冲突。
              </div>
            </div>
          )}

          {/* 接口卡片网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredEndpoints.map((item) => {
              const IconComponent = item.icon;
              const directUrl = `${origin}${item.path}`;
              const currentPreviewText = formatOutput(origin, item.path, previewFormat);

              const isUrlCopied = copiedKey === `${item.id}-url`;
              const isMarkdownCopied = copiedKey === `${item.id}-markdown`;
              const isHtmlCopied = copiedKey === `${item.id}-html`;
              const isCodeBoxCopied = copiedKey === `${item.id}-preview`;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/80 bg-background/50 hover:bg-background/90 p-4 transition-all duration-200 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs group"
                >
                  {/* 卡片头部 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
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
                  <div className="relative group/box">
                    <pre
                      onClick={() => handleCopy(currentPreviewText, `${item.id}-preview`)}
                      className="p-2.5 rounded-lg bg-muted/60 hover:bg-muted/90 text-[11px] font-mono text-foreground/90 overflow-x-auto border border-border/60 transition-colors cursor-pointer select-all"
                      title="点击直接复制此格式"
                    >
                      <code>{currentPreviewText}</code>
                    </pre>
                    <div className="absolute right-2 top-2 pointer-events-none opacity-0 group-hover/box:opacity-100 transition-opacity text-[10px] bg-background/90 text-foreground px-1.5 py-0.5 rounded shadow-2xs">
                      {isCodeBoxCopied ? "已复制!" : "点击复制"}
                    </div>
                  </div>

                  {/* 底部按钮栏：URL, MD, HTML, 测试 */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                    <div className="flex items-center gap-1.5">
                      {/* 复制 URL */}
                      <button
                        type="button"
                        onClick={() => handleCopy(directUrl, `${item.id}-url`)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                          isUrlCopied
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                        title="复制直接 URL"
                      >
                        {isUrlCopied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span>{isUrlCopied ? "已复制" : "URL"}</span>
                      </button>

                      {/* 复制 Markdown */}
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            formatOutput(origin, item.path, "markdown"),
                            `${item.id}-markdown`
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                          isMarkdownCopied
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                        title="复制 Markdown 嵌入语法"
                      >
                        {isMarkdownCopied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Code className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span>{isMarkdownCopied ? "已复制" : "MD"}</span>
                      </button>

                      {/* 复制 HTML */}
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            formatOutput(origin, item.path, "html"),
                            `${item.id}-html`
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                          isHtmlCopied
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                        title="复制 HTML img 标签"
                      >
                        {isHtmlCopied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Code className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span>{isHtmlCopied ? "已复制" : "HTML"}</span>
                      </button>
                    </div>

                    {/* 在线测试链接 */}
                    <a
                      href={directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="新窗口打开测试"
                    >
                      <span>测试</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 专栏板块：Cloudflare 边缘重写配置指南与防冲突规则生成器 */}
          <div className="mt-6 rounded-xl border border-border/80 bg-background/60 p-4 sm:p-5 space-y-4">
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isCfGuideOpen}
              onClick={() => setIsCfGuideOpen((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsCfGuideOpen((prev) => !prev);
                }
              }}
              className="flex items-center justify-between cursor-pointer group select-none"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Cloudflare 边缘防冲突重写规则参考与生成器
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-normal">
                      零消耗·无限流量
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    针对当前站点所有分类一键生成规范表达式，解决多分类“打架”、误伤与 404 隐患
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                <span>{isCfGuideOpen ? "收起规则" : "展开配置规则"}</span>
                {isCfGuideOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>

            {isCfGuideOpen && (
              <div className="pt-3 border-t border-border/50 space-y-4 text-xs">
                {/* 核心原理与防打架说明 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>1. 精准路径前缀隔离</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      匹配条件必须采用 <code className="bg-background px-1 py-0.5 rounded font-mono">eq &quot;/cat&quot; or starts_with(&quot;/cat/&quot;)</code>。若只写模糊的 <code className="bg-background px-1 py-0.5 rounded font-mono">starts_with(&quot;/a&quot;)</code>，新增 <code className="font-mono">/anime</code> 时会被 <code className="font-mono">/a</code> 规则抢先拦截导致冲突失效！
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>2. 杜绝末尾斜杠 404</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      重写目标使用固定前缀 <code className="bg-background px-1 py-0.5 rounded font-mono">concat(&quot;/cat/&quot;, ...)</code>。若写成拼接原路径，当浏览器访问带斜杠的 <code className="font-mono">/a/</code> 时会拼出双斜杠 <code className="font-mono">/a//00.jpeg</code> 引发 404。
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>3. 严格对齐真实扩展名</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      不同分类扩展名不同（横屏竖屏为 <code className="font-mono">.jpg</code>，头像为 <code className="font-mono">.jpeg</code>，GIF 为 <code className="font-mono">.gif</code>）。生成器已自动读取分类元数据，严禁全写成 .jpg。
                    </p>
                  </div>
                </div>

                {/* 各分类规则速查生成器 */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center justify-between">
                    <span>当前站点分类规则（进入 Cloudflare 控制台 -&gt; Rules -&gt; Transform Rules -&gt; URL Rewrite）：</span>
                    <span className="text-[11px] text-muted-foreground font-normal">重写类型必须选择 Dynamic (动态)</span>
                  </h4>

                  <div className="space-y-2.5">
                    {keys.map((catKey) => {
                      const ext = categoryExts[catKey];
                      const label = CATEGORY_NAMES[catKey] || catKey;
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
                            <span className="font-semibold text-foreground flex items-center gap-2">
                              <span>分类：{label} (<code className="font-mono">/{catKey}</code>)</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                                产物后缀: {ext}
                              </span>
                            </span>
                          </div>

                          {/* 匹配表达式 */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>1. 匹配条件 (When incoming requests match - Custom expression):</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(matchExpr, `cf-match-${catKey}`)}
                                className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                              >
                                {isMatchCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                <span>{isMatchCopied ? "已复制条件" : "复制条件"}</span>
                              </button>
                            </div>
                            <pre className="p-2 rounded bg-muted/60 text-[11px] font-mono text-foreground overflow-x-auto select-all">
                              <code>{matchExpr}</code>
                            </pre>
                          </div>

                          {/* 路径重写表达式 */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>2. 重写路径至 (Path rewrite to - Dynamic):</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(rewriteExpr, `cf-rewrite-${catKey}`)}
                                className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                              >
                                {isRewriteCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                <span>{isRewriteCopied ? "已复制表达式" : "复制表达式"}</span>
                              </button>
                            </div>
                            <pre className="p-2 rounded bg-muted/60 text-[11px] font-mono text-foreground overflow-x-auto select-all">
                              <code>{rewriteExpr}</code>
                            </pre>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
