"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Copy, ImageOff, LoaderCircle, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface PreviewCategory {
  key: string;
  labelZh: string;
  labelEn: string;
}

type ImageStatus = "loading" | "loaded" | "error";

function PreviewImage({ src, label, onStatus }: {
  src: string;
  label: string;
  onStatus: (status: ImageStatus) => void;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<ImageStatus>("loading");
  const settled = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    const timer = window.setTimeout(() => {
      if (!settled.current) {
        settled.current = true;
        setStatus("error");
        onStatus("error");
      }
    }, 20000);
    return () => {
      active.current = false;
      window.clearTimeout(timer);
    };
  }, [onStatus]);

  function finish(next: "loaded" | "error") {
    if (!active.current) return;
    settled.current = true;
    setStatus(next);
    onStatus(next);
  }

  return (
    <>
      <Image
        src={src}
        alt={`${t.home.previewAlt} · ${label}`}
        fill
        sizes="(max-width: 896px) 100vw, 832px"
        className={`object-contain p-3 sm:p-5 transition-opacity duration-150 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
        onLoad={() => finish("loaded")}
        onError={() => finish("error")}
        unoptimized
      />
      {status !== "loaded" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6 text-center" role="status">
          {status === "loading" ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : <ImageOff className="size-7" aria-hidden="true" />}
          <span className="text-sm">{status === "loading" ? t.home.previewLoading : t.home.previewError}</span>
        </div>
      )}
    </>
  );
}

export function LivePreview({ categories }: { categories: PreviewCategory[] }) {
  const { lang, t } = useI18n();
  const [request, setRequest] = useState({ category: "h", seed: 0 });
  const [status, setStatus] = useState<ImageStatus>("loading");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRequest = useRef(0);
  const selected = categories.find((category) => category.key === request.category) ?? categories[0];
  const category = selected?.key ?? "h";
  const label = selected ? (lang === "zh" ? selected.labelZh : selected.labelEn) : category;
  const src = `/pic?img=${encodeURIComponent(category)}&_t=${request.seed}`;

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    currentRequest.current += 1;
  }, []);

  function refresh(nextCategory = category) {
    currentRequest.current += 1;
    setStatus("loading");
    setCopyState("idle");
    setRequest((previous) => ({ category: nextCategory, seed: previous.seed + 1 }));
  }

  async function copyLink() {
    const requestId = currentRequest.current;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/pic?img=${encodeURIComponent(category)}`);
      if (currentRequest.current !== requestId) return;
      setCopyState("copied");
      copyTimer.current = setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      if (currentRequest.current !== requestId) return;
      console.warn("Could not copy the preview link:", error);
      setCopyState("error");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/80 p-1" role="group" aria-label={t.home.categoriesTitle}>
          {categories.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={category === item.key}
              onClick={() => { if (category !== item.key) refresh(item.key); }}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${category === item.key ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}
            >
              {lang === "zh" ? item.labelZh : item.labelEn}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => refresh()} aria-controls="live-image-preview" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-xs hover:opacity-85 transition-opacity">
            <RefreshCw className={`size-3.5 shrink-0 ${status === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>{status === "error" ? t.home.retry : t.home.refreshBtn}</span>
          </button>
          <button type="button" onClick={copyLink} className="inline-flex min-h-9 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-muted px-3 py-2 text-xs font-medium hover:bg-muted/70 transition-colors">
            {copyState === "copied" ? <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            <span>{copyState === "copied" ? t.home.copied : t.home.copyDirectBtn}</span>
          </button>
        </div>
      </div>
      <div id="live-image-preview" className="preview-stage relative w-full overflow-hidden rounded-xl border border-border/60" aria-busy={status === "loading"}>
        <PreviewImage key={src} src={src} label={label} onStatus={setStatus} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <code className="inline-flex items-center gap-2 font-mono"><span className={`size-1.5 rounded-full ${status === "error" ? "bg-destructive" : status === "loaded" ? "bg-emerald-500" : "bg-amber-500"}`} />GET /pic?img={category}</code>
        <span>{t.home.previewNote}</span>
      </div>
      <p className={`text-xs ${copyState === "error" ? "text-destructive" : "sr-only"}`} aria-live="polite">{copyState === "error" ? t.home.copyFailed : copyState === "copied" ? t.home.copied : ""}</p>
    </div>
  );
}
