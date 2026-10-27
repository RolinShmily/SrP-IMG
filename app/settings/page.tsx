"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ApiPanel } from "@/components/api-panel";
import { useI18n } from "@/lib/i18n";
import { SlidersHorizontal, Sparkles } from "lucide-react";

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Navbar />

      <main id="main-content" className="container mx-auto px-4 py-8 sm:py-10 max-w-6xl flex-1">
        {/* 页面标题 Header */}
        <div className="mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{t.nav.settings}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {t.settings.title}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
            {t.settings.subtitle}
          </p>
        </div>

        {/* API 调用方式（默认展开） */}
        <ApiPanel defaultOpen={true} />

        {/* 补充：UA 分流说明 */}
        <div className="mt-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>{t.home.featUaTitle}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t.home.featUaDesc}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
