"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ImageGallery } from "@/components/image-gallery";
import { useI18n } from "@/lib/i18n";
import { GALLERY_MESSAGES } from "@/lib/gallery-translations";

interface CategoryItem {
  key: string;
  labelZh: string;
  labelEn: string;
  count?: number;
}

const CATEGORY_NAMES_ZH: Record<string, string> = {
  h: "横屏",
  v: "竖屏",
  a: "头像",
  gif: "GIF",
};

const CATEGORY_NAMES_EN: Record<string, string> = {
  h: "Horizontal",
  v: "Vertical",
  a: "Avatar",
  gif: "GIF",
};

const PREFERRED_ORDER = ["h", "v", "a", "gif"];

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { key: "h", labelZh: "横屏", labelEn: "Horizontal" },
  { key: "v", labelZh: "竖屏", labelEn: "Vertical" },
  { key: "a", labelZh: "头像", labelEn: "Avatar" },
  { key: "gif", labelZh: "GIF", labelEn: "GIF" },
];

function GalleryContent() {
  const searchParams = useSearchParams();
  const galleryType = searchParams.get("cat") || "h";
  const { lang, t } = useI18n();
  const messages = GALLERY_MESSAGES[lang];

  const selectCategory = (key: string) => {
    // Read the live URL so rapid clicks retain the latest query parameters.
    // Next's native History integration updates useSearchParams and handles
    // back/forward without a second, competing selected-category state.
    const url = new URL(window.location.href);
    if ((url.searchParams.get("cat") || "h") === key) return;
    url.searchParams.set("cat", key);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCounts() {
      try {
        const res = await fetch("/counts.json", { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (controller.signal.aborted) return;

        if (Array.isArray(data.categories) && data.categories.length > 0) {
          const dynamicCats: CategoryItem[] = data.categories.map((c: {
            key: string;
            name_zh?: string;
            name_en?: string;
            count?: number;
          }) => ({
            key: c.key,
            labelZh: c.name_zh || CATEGORY_NAMES_ZH[c.key] || c.key,
            labelEn: c.name_en || CATEGORY_NAMES_EN[c.key] || c.key,
            count: data.real_counts?.[c.key] ?? c.count ?? data.counts?.[c.key],
          }));
          setCategories(dynamicCats);
        } else {
          const countsMap: Record<string, number> =
            data.real_counts || data.counts || {};

          const keys = Object.keys(countsMap);
          if (keys.length > 0) {
            keys.sort((a, b) => {
              const idxA = PREFERRED_ORDER.indexOf(a);
              const idxB = PREFERRED_ORDER.indexOf(b);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return a.localeCompare(b);
            });

            const dynamicCats: CategoryItem[] = keys.map((key) => ({
              key,
              labelZh: CATEGORY_NAMES_ZH[key] || key,
              labelEn: CATEGORY_NAMES_EN[key] || key,
              count: countsMap[key],
            }));

            setCategories(dynamicCats);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) console.warn("Failed to load counts.json:", err);
      }
    }

    loadCounts();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="min-w-0 space-y-6">
      {/* 头部标题与动态分类导航 Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t.gallery.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t.gallery.subtitle}
          </p>
        </div>

        {/* 动态分类切换 Tab 栏与数量徽标（横向平滑滚动防折行） */}
        <div role="group" aria-label={messages.categories} className="flex min-w-0 md:max-w-[65%] items-center gap-1.5 sm:gap-2 rounded-xl bg-muted/80 p-1 border border-border/50 overflow-x-auto max-w-full scrollbar-none py-1 px-1.5">
          {categories.map((cat) => {
            const isActive = galleryType === cat.key;
            const label = lang === "zh" ? cat.labelZh : cat.labelEn;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => selectCategory(cat.key)}
                aria-pressed={isActive}
                aria-controls="gallery-images"
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-ring ${
                  isActive
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                <span>{label}</span>
                {typeof cat.count === "number" && Number.isSafeInteger(cat.count) && cat.count >= 0 && (
                  <span
                    className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground"
                    }`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 画廊展示主体 */}
      <div id="gallery-images" className="min-w-0">
        <ImageGallery key={galleryType} type={galleryType} />
      </div>
    </div>
  );
}

function GalleryLoading() {
  const { t } = useI18n();
  return <div className="py-12 text-center text-muted-foreground" role="status">{t.gallery.loading}</div>;
}

export default function GalleryPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Navbar />

      <main id="main-content" className="container mx-auto min-w-0 px-4 py-8 max-w-7xl flex-1">
        <Suspense fallback={<GalleryLoading />}>
          <GalleryContent />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
