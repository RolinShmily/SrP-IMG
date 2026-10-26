"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useI18n } from "@/lib/i18n";
import {
  Sparkles,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Zap,
  Smartphone,
  Layers,
  Image as ImageIcon,
} from "lucide-react";

interface CategoryStat {
  key: string;
  labelZh: string;
  labelEn: string;
  count: number;
  ext: string;
  aspect: string;
}

const CATEGORY_NAMES_ZH: Record<string, string> = {
  h: "横屏壁纸",
  v: "竖屏壁纸",
  a: "头像素材",
  gif: "动态动图",
};

const CATEGORY_NAMES_EN: Record<string, string> = {
  h: "Landscape Wallpapers",
  v: "Portrait Wallpapers",
  a: "Avatars & Profiles",
  gif: "Animated GIFs",
};

const CATEGORY_ASPECTS: Record<string, string> = {
  h: "4:3 / 16:9",
  v: "9:16",
  a: "1:1",
  gif: "动态格式",
};

export default function HomePage() {
  const { lang, t } = useI18n();
  const [categories, setCategories] = useState<CategoryStat[]>([
    { key: "h", labelZh: "横屏壁纸", labelEn: "Landscape", count: 138, ext: ".jpg", aspect: "4:3 / 16:9" },
    { key: "v", labelZh: "竖屏壁纸", labelEn: "Portrait", count: 67, ext: ".jpg", aspect: "9:16" },
    { key: "a", labelZh: "头像素材", labelEn: "Avatar", count: 114, ext: ".jpeg", aspect: "1:1" },
    { key: "gif", labelZh: "动态动图", labelEn: "GIF", count: 10, ext: ".gif", aspect: "动态格式" },
  ]);

  // Live Demo 状态
  const [demoCat, setDemoCat] = useState<string>("h");
  const [randomSeed, setRandomSeed] = useState<number>(() => Date.now());
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const res = await fetch("/counts.json");
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (Array.isArray(data.categories) && data.categories.length > 0) {
          const stats: CategoryStat[] = data.categories.map((c: {
            key: string;
            name_zh?: string;
            name_en?: string;
            count?: number;
            ext?: string;
            aspect_hint?: string;
          }) => ({
            key: c.key,
            labelZh: c.name_zh || c.key,
            labelEn: c.name_en || c.key,
            count: c.count || 0,
            ext: c.ext || ".jpg",
            aspect: c.aspect_hint || "自适应",
          }));
          setCategories(stats);
          if (data.categories[0]?.key && !data.categories.some((c: { key: string }) => c.key === "h")) {
            setDemoCat(data.categories[0].key);
          }
        } else {
          const countsMap = data.real_counts || data.counts || {};
          const extsMap = data.category_exts || {};
          const keys = Object.keys(countsMap);

          if (keys.length > 0) {
            const order = ["h", "v", "a", "gif"];
            keys.sort((a, b) => {
              const idxA = order.indexOf(a);
              const idxB = order.indexOf(b);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return a.localeCompare(b);
            });

            const stats: CategoryStat[] = keys.map((key) => ({
              key,
              labelZh: CATEGORY_NAMES_ZH[key] || `${key} 分类`,
              labelEn: CATEGORY_NAMES_EN[key] || `${key} category`,
              count: countsMap[key] || 0,
              ext: extsMap[key] || ".jpg",
              aspect: CATEGORY_ASPECTS[key] || "自适应",
            }));

            setCategories(stats);
          }
        }
      } catch {
        // fallback to defaults
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRandomize = () => {
    setIsImageLoading(true);
    setRandomSeed(Date.now());
  };

  const currentDemoUrl = `/pic?img=${demoCat}&_t=${randomSeed}`;

  const handleCopyLink = async () => {
    const fullUrl = `${typeof window !== "undefined" ? window.location.origin : "https://img.srprolin.com"}/pic?img=${demoCat}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Navbar />

      <main className="flex-1">
        {/* 1. Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-border/50 bg-gradient-to-b from-muted/30 via-background to-background">
          <div className="container mx-auto px-4 max-w-5xl text-center space-y-6">
            {/* 顶栏徽章 */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.home.badge}</span>
            </div>

            {/* 标题 */}
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-balance bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70">
              {t.home.heroTitle}
            </h1>

            {/* 副标题 */}
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
              {t.home.heroSubtitle}
            </p>

            {/* 核心行动按钮 */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Link
                href="/gallery"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <ImageIcon className="w-4 h-4" />
                <span>{t.home.exploreBtn}</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </Link>

              <Link
                href="/settings"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-sm border border-border/80 shadow-2xs transition-all duration-200"
              >
                <span>{t.home.settingsBtn}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 2. 在线实时体验卡片 (Live Interactive Demo) */}
        <section className="py-12 sm:py-16 border-b border-border/40 bg-muted/20">
          <div className="container mx-auto px-4 max-w-4xl space-y-6">
            <div className="text-center space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {t.home.liveDemoTitle}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t.home.liveDemoSubtitle}
              </p>
            </div>

            {/* 交互体验盒 */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
              {/* 分类切换 Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-muted/80 p-1 rounded-xl">
                  {categories.map((c) => {
                    const label = lang === "zh" ? c.labelZh : c.labelEn;
                    const isActive = demoCat === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          setDemoCat(c.key);
                          setIsImageLoading(true);
                          setRandomSeed(Date.now());
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isActive
                            ? "bg-background text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRandomize}
                    disabled={isImageLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-2xs hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-70"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isImageLoading ? "animate-spin" : ""}`} />
                    <span>{t.home.refreshBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium border border-border/80 transition-colors cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{t.home.copyDirectBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 实时图片预览窗口 */}
              <div className="relative w-full h-72 sm:h-96 rounded-xl bg-muted/60 overflow-hidden flex items-center justify-center border border-border/60">
                <Image
                  key={`${demoCat}-${randomSeed}`}
                  src={currentDemoUrl}
                  alt={`Live random demo (${demoCat})`}
                  fill
                  className={`object-cover transition-all duration-300 ${isImageLoading ? "opacity-60 scale-[1.01] blur-xs" : "opacity-100 scale-100 blur-0"}`}
                  onLoad={() => setIsImageLoading(false)}
                  onError={() => setIsImageLoading(false)}
                  unoptimized
                />

                {/* 悬浮路由指示 */}
                <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-mono text-foreground border border-border/60 shadow-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>GET /pic?img={demoCat}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 分类全景看板 (Category Overview Cards) */}
        <section className="py-12 sm:py-16 border-b border-border/40">
          <div className="container mx-auto px-4 max-w-6xl space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {t.home.categoriesTitle}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {t.home.categoriesSubtitle}
                </p>
              </div>

              <Link
                href="/gallery"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-primary font-medium hover:underline"
              >
                <span>{t.home.exploreBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* 卡片网格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {categories.map((c) => {
                const label = lang === "zh" ? c.labelZh : c.labelEn;
                return (
                  <Link
                    key={c.key}
                    href={`/gallery?cat=${c.key}`}
                    className="p-5 rounded-2xl border border-border bg-card hover:bg-muted/40 transition-all duration-200 group flex flex-col justify-between gap-4 shadow-2xs hover:shadow-xs hover:border-primary/40"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                          /{c.key}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {c.aspect}
                        </span>
                      </div>
                      <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                        {label}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {c.count} {t.gallery.countSuffix} ({c.ext})
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground group-hover:text-foreground pt-2 border-t border-border/40 font-medium">
                      <span>浏览画廊</span>
                      <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. 核心架构与特性矩阵 (Feature Cards) */}
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 max-w-6xl space-y-8">
            <div className="text-center space-y-1.5 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {t.home.featuresTitle}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t.home.featuresSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl border border-border bg-card/60 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base text-foreground">
                  {t.home.featFreeTitle}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t.home.featFreeDesc}
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-border bg-card/60 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base text-foreground">
                  {t.home.featEdgeTitle}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t.home.featEdgeDesc}
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-border bg-card/60 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base text-foreground">
                  {t.home.featSecurityTitle}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t.home.featSecurityDesc}
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-border bg-card/60 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base text-foreground">
                  {t.home.featUaTitle}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t.home.featUaDesc}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
