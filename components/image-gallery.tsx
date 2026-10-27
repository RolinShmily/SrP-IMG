"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import { Copy, Check, ArrowUp } from "lucide-react"
import { Fancybox, type FancyboxOptions, type FancyboxInstance } from "@fancyapps/ui"
import { zh_CN } from "@fancyapps/ui/dist/fancybox/l10n/zh_CN.js"
import { en_EN } from "@fancyapps/ui/dist/fancybox/l10n/en_EN.js"
import { useI18n } from "@/lib/i18n"
import { GALLERY_MESSAGES } from "@/lib/gallery-translations"
import "@fancyapps/ui/dist/fancybox/fancybox.css"

interface ImageGalleryProps {
  type: string;
}

interface GalleryManifest {
  count: number;
  hashLength: number;
  fileExt: string;
  /** width / height per generated slot, so boxes are reserved before load. */
  slotRatios: number[];
}

interface CountsData {
  real_counts?: Record<string, number>;
  counts?: Record<string, number>;
  hash_length?: number;
  category_exts?: Record<string, string>;
  output_ext?: string;
  category_aspects?: Record<string, string | null>;
  slot_ratios?: Record<string, number[]>;
  categories?: { key: string; count?: number; ext?: string }[];
}

const DEFAULT_RATIO = 4 / 3;

/** "4/3" -> 1.3333; anything malformed falls back to DEFAULT_RATIO. */
function parseAspect(value: string | null | undefined): number | null {
  if (!value) return null;
  const [w, h] = value.split("/").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return w / h;
}

type CopyResult = { id: number; status: "pending" | "success" | "error" } | null;
const IMAGES_PER_PAGE = 20;

async function copyText(text: string, isCurrent: () => boolean): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard permission may be denied; try the legacy copy command below.
    }
  }

  // A permission prompt can outlive the gallery; do not run a fallback copy
  // or move focus after its category has been replaced.
  if (!isCurrent()) return false;
  const activeElement = document.activeElement;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  try {
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand("copy");
  } catch {
    // A rejected command is reported to the user by the caller.
    return false;
  } finally {
    textarea.remove();
    if (activeElement instanceof HTMLElement && activeElement.isConnected) {
      activeElement.focus({ preventScroll: true });
    }
  }
}

// Own the category key here as well, so all callers get a fresh request and
// pagination/copy state even if they do not supply a React key themselves.
export function ImageGallery({ type }: ImageGalleryProps) {
  const folder = type === "horizontal" ? "h" : type === "vertical" ? "v" : type === "avatar" ? "a" : type;
  return <GalleryImages key={folder} folder={folder} />;
}

function GalleryImages({ folder }: { folder: string }) {
  const { lang, t } = useI18n();
  const messages = GALLERY_MESSAGES[lang];
  const [manifest, setManifest] = useState<GalleryManifest | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [visibleCount, setVisibleCount] = useState(IMAGES_PER_PAGE);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [imageLoaded, setImageLoaded] = useState<Set<number>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copyResult, setCopyResult] = useState<CopyResult>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyGenerationRef = useRef(0);
  const copyPendingRef = useRef(false);
  const pagePendingRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const galleryContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadManifest() {
      try {
        const response = await fetch("/counts.json", { signal: controller.signal });
        if (!response.ok) throw new Error(`Gallery metadata: HTTP ${response.status}`);
        const data: CountsData = await response.json();
        if (!data || typeof data !== "object") throw new Error("Invalid gallery metadata");
        const category = data.categories?.find((item) => item.key === folder);
        const counts = data.real_counts ?? data.counts;
        const count = counts?.[folder] ?? category?.count ?? (counts || data.categories ? 0 : undefined);
        if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
          throw new Error("Invalid gallery image count");
        }
        const hashLength = data.hash_length ?? 2;
        const fileExt = data.category_exts?.[folder] ?? category?.ext ?? data.output_ext ?? ".jpg";
        const perSlot = data.slot_ratios?.[folder];
        const slotRatios = Array.isArray(perSlot)
          ? perSlot.map((ratio) => (typeof ratio === "number" && ratio > 0 && Number.isFinite(ratio) ? ratio : DEFAULT_RATIO))
          : [];
        const fallbackRatio = parseAspect(data.category_aspects?.[folder]) ?? DEFAULT_RATIO;
        if (!Number.isInteger(hashLength) || hashLength < 1 || hashLength > 32 || !/^\.[a-z0-9]+$/i.test(fileExt)) {
          throw new Error("Invalid gallery filename metadata");
        }
        if (!controller.signal.aborted) {
          setManifest({
            count,
            hashLength,
            fileExt,
            slotRatios: slotRatios.length > 0 ? slotRatios : new Array(count).fill(fallbackRatio),
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("Failed to load gallery metadata:", error);
          setLoadError(true);
        }
      }
    }
    void loadManifest();
    return () => controller.abort();
  }, [folder, retry]);

  // Deriving IDs from one count avoids duplicate batches from stale observer
  // callbacks and keeps pagination atomic under React's batched updates.
  const images = useMemo(() => manifest ? Array.from(
    { length: Math.min(visibleCount, manifest.count) },
    (_, id) => ({
      id,
      url: `/${encodeURIComponent(folder)}/${id.toString(16).padStart(manifest.hashLength, "0")}${manifest.fileExt}`,
      // Slot index is reused cyclically if metadata is shorter than the count.
      ratio: manifest.slotRatios[id % manifest.slotRatios.length] ?? DEFAULT_RATIO,
    }),
  ) : [], [folder, manifest, visibleCount]);
  const hasMore = manifest !== null && visibleCount < manifest.count;

  const loadMore = useCallback(() => {
    if (!manifest || pagePendingRef.current) return;
    pagePendingRef.current = true;
    setVisibleCount((count) => Math.min(count + IMAGES_PER_PAGE, manifest.count));
  }, [manifest]);

  useEffect(() => {
    pagePendingRef.current = false;
    const target = loadMoreRef.current;
    if (!target || !hasMore || typeof IntersectionObserver === "undefined") return;
    let active = true;
    const observer = new IntersectionObserver((entries) => {
      if (active && entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { rootMargin: "200px 0px", threshold: 0 });
    observer.observe(target);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [hasMore, loadMore, visibleCount]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopyDirectUrl = async (imageUrl: string, id: number) => {
    if (copyPendingRef.current) return;
    copyPendingRef.current = true;
    const generation = ++copyGenerationRef.current;
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    setCopyResult({ id, status: "pending" });
    const success = await copyText(
      new URL(imageUrl, window.location.origin).href,
      () => generation === copyGenerationRef.current,
    );
    if (generation !== copyGenerationRef.current) return;
    copyPendingRef.current = false;
    setCopyResult({ id, status: success ? "success" : "error" });
    copyTimeoutRef.current = setTimeout(() => setCopyResult(null), 3000);
  };

  useEffect(() => () => {
    // Ignore an in-flight clipboard result after category changes/unmount.
    copyGenerationRef.current += 1;
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
  }, []);

  useEffect(() => {
    const container = galleryContainerRef.current;
    if (!container) return;
    const instances = new Set<FancyboxInstance>();
    const locale = lang === "zh" ? zh_CN : en_EN;
    const options: Partial<FancyboxOptions> = {
      Hash: false,
      l10n: locale,
      placeFocusBack: true,
      // v6 defaults reverse PageUp/PageDown; follow normal page navigation.
      keyboard: { ...Fancybox.getDefaults().keyboard, PageUp: "prev", PageDown: "next" },
      Carousel: {
        l10n: locale,
        Thumbs: { type: "classic" },
        Toolbar: {
          display: {
            left: ["counter"],
            middle: ["zoomIn", "zoomOut", "toggle1to1", "rotateCCW", "rotateCW", "flipX", "flipY"],
            right: ["autoplay", "fullscreen", "download", "thumbs", "close"],
          },
        },
      },
      on: {
        init: (instance) => { instances.add(instance); },
        destroy: (instance) => { instances.delete(instance); },
      },
    };
    // Delegated binding automatically includes newly appended images. Binding
    // only on language changes also keeps load-more from closing a preview.
    Fancybox.bind(container, "[data-fancybox]", options);
    return () => {
      Fancybox.unbind(container);
      for (const instance of instances) instance.destroy();
    };
  }, [lang]);

  const copyAnnouncement = copyResult?.status === "success"
    ? messages.copiedAnnouncement(copyResult.id)
    : copyResult?.status === "error" ? messages.failedAnnouncement(copyResult.id) : "";

  return (
    <div className="gallery-enter w-full min-w-0" ref={galleryContainerRef}>
      <p className="sr-only" role="status" aria-live="polite">{copyAnnouncement}</p>
      <div className={`columns-1 min-[360px]:columns-2 md:columns-3 gap-3 sm:gap-4 ${folder === "gif" ? "lg:columns-5" : "lg:columns-4"}`}>
        {images.map((image) => (
          <div
            key={image.id}
            // The box is reserved from the slot's real ratio, so nothing reflows
            // when the bitmap arrives -- that reflow was the scroll flicker.
            style={{ aspectRatio: String(image.ratio) }}
            className="group relative mb-3 sm:mb-4 break-inside-avoid overflow-hidden rounded-lg bg-muted"
          >
            {imageErrors.has(image.id) ? (
              <div className="flex h-full w-full items-center justify-center p-3 text-center">
                <p className="text-xs text-muted-foreground">{messages.imageUnavailable(image.id)}</p>
              </div>
            ) : (
              <>
                <a
                  data-fancybox="gallery"
                  href={image.url}
                  data-caption={`#${image.id}`}
                  aria-label={messages.previewLabel(image.id)}
                  className="absolute inset-0 block cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  {/* Skeleton sits behind the bitmap and is painted over once it decodes. */}
                  {!imageLoaded.has(image.id) && (
                    <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-muted-foreground/10 motion-reduce:animate-none" />
                  )}
                  <Image
                    src={image.url}
                    alt={messages.imageAlt(image.id)}
                    width={800}
                    height={800}
                    className={`h-full w-full object-contain transition-opacity duration-200 motion-reduce:transition-none ${
                      imageLoaded.has(image.id) ? "opacity-100" : "opacity-0"
                    }`}
                    sizes={folder === "gif"
                      ? "(max-width: 359px) 100vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, 20vw"
                      : "(max-width: 359px) 100vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"}
                    loading={image.id < 8 ? "eager" : "lazy"}
                    onLoad={() => setImageLoaded((previous) => previous.has(image.id) ? previous : new Set(previous).add(image.id))}
                    onError={() => setImageErrors((previous) => new Set(previous).add(image.id))}
                  />
                </a>
                <button
                  type="button"
                  aria-disabled={copyResult?.status === "pending"}
                  onClick={() => { void handleCopyDirectUrl(image.url, image.id); }}
                  className="absolute top-2 left-2 max-w-[calc(100%-1rem)] inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-background text-foreground text-xs font-medium shadow-xs [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring transition-opacity duration-200 motion-reduce:transition-none cursor-pointer aria-disabled:cursor-wait border border-border"
                  title={messages.copyLabel(image.id)}
                  aria-label={messages.copyLabel(image.id)}
                >
                  {copyResult?.id === image.id && copyResult.status === "success"
                    ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                    : <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                  <span className="min-w-0 break-words">
                    {copyResult?.id === image.id
                      ? copyResult.status === "success" ? t.gallery.copySuccess
                        : copyResult.status === "error" ? messages.copyFailed : messages.copying
                      : t.gallery.copyDirect}
                  </span>
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} className="flex justify-center py-8 text-center" aria-live="polite">
        {!manifest && !loadError && <p className="text-muted-foreground">{t.gallery.loading}</p>}
        {loadError && (
          <div className="space-y-3">
            <p className="text-muted-foreground" role="alert">{messages.loadError}</p>
            <button type="button" onClick={() => { setLoadError(false); setRetry((value) => value + 1); }} className="rounded-md border px-4 py-2 text-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">
              {messages.retry}
            </button>
          </div>
        )}
        {manifest?.count === 0 && (
          <div className="py-12 px-3">
            <p className="font-medium">{t.gallery.emptyTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{messages.emptyDescription}</p>
          </div>
        )}
        {hasMore && (
          <button type="button" onClick={loadMore} className="rounded-md border px-4 py-2 text-sm cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
            {messages.loadMore}
          </button>
        )}
        {manifest && manifest.count > 0 && !hasMore && (
          <p className="text-muted-foreground text-sm">{messages.loadedAll(manifest.count)}</p>
        )}
      </div>

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
          className="fixed bottom-6 right-4 sm:right-8 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl focus-visible:outline-2 focus-visible:outline-ring z-40"
          aria-label={messages.scrollTop}
        >
          <ArrowUp className="w-5 h-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
