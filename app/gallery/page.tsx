"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ImageGallery } from "@/components/image-gallery";
import { useI18n } from "@/lib/i18n";

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
  { key: "h", labelZh: "横屏", labelEn: "Horizontal", count: 138 },
  { key: "v", labelZh: "竖屏", labelEn: "Vertical", count: 67 },
  { key: "a", labelZh: "头像", labelEn: "Avatar", count: 114 },
  { key: "gif", labelZh: "GIF", labelEn: "GIF", count: 10 },
];

function GalleryContent() {
  const searchParams = useSearchParams();
  const initialCat = searchParams.get("cat") || "h";
  const { lang, t } = useI18n();

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const galleryType = selectedCat ?? initialCat;
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    let isMounted = true;

    async function loadCounts() {
      try {
        const res = await fetch("/counts.json");
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (Array.isArray(data.categories) && data.categories.length > 0) {
          const dynamicCats: CategoryItem[] = data.categories.map((c: {
            key: string;
            name_zh?: string;
            name_en?: string;
            count?: number;
          }) => ({
            key: c.key,
            labelZh: c.name_zh || c.key,
            labelEn: c.name_en || c.key,
            count: c.count,
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
        console.warn("Failed to load counts.json:", err);
      }
    }

    loadCounts();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* 头部标题与动态分类导航 Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t.gallery.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t.gallery.subtitle}
          </p>
        </div>

        {/* 动态分类切换 Tab 栏与数量徽标（横向平滑滚动防折行） */}
        <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-muted/80 p-1 border border-border/50 overflow-x-auto max-w-full scrollbar-none py-1 px-1.5">
          {categories.map((cat) => {
            const isActive = galleryType === cat.key;
            const label = lang === "zh" ? cat.labelZh : cat.labelEn;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCat(cat.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                <span>{label}</span>
                {typeof cat.count === "number" && (
                  <span
                    className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-none transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-bold"
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
      <ImageGallery key={galleryType} type={galleryType} />
    </div>
  );
}

export default function GalleryPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-7xl flex-1">
        <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading gallery...</div>}>
          <GalleryContent />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
