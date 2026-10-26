"use client";

import { useI18n } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LangToggle() {
  const { lang, setLang } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border"
      title={lang === "zh" ? "Switch to English" : "切换为中文"}
      aria-label="Toggle language"
    >
      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
      <span>{lang === "zh" ? "EN" : "中"}</span>
    </button>
  );
}
