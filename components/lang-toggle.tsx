"use client";

import { useI18n } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LangToggle() {
  const { lang, setLang, t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className="inline-flex h-9 w-12 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted transition-colors border border-transparent hover:border-border"
      title={t.nav.switchLanguage}
      aria-label={t.nav.switchLanguage}
    >
      <Globe className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
      <span>{lang === "zh" ? "EN" : "中"}</span>
    </button>
  );
}
