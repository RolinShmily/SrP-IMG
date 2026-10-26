"use client"

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react"
import Image from "next/image"
import { Copy, Check } from "lucide-react"
import { Fancybox, type FancyboxOptions } from "@fancyapps/ui"
import "@fancyapps/ui/dist/fancybox/fancybox.css"

// Thumbs and Toolbar are plugin options that @fancyapps/ui v6 does not declare in
// its shipped FancyboxOptions type, so they are spelled out explicitly here.
type FancyboxBindOptions = Partial<FancyboxOptions> & {
  Thumbs: { type: string }
  Toolbar: { display: { left: string[]; middle: string[]; right: string[] } }
}

interface ImageGalleryProps {
  type: "horizontal" | "vertical" | "avatar" | "gif" | string;
}

interface ImageItem {
  id: number
  url: string
  error?: boolean
  loaded?: boolean
}

export function ImageGallery({ type }: ImageGalleryProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [maxCount, setMaxCount] = useState<number>(0);
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [imageLoaded, setImageLoaded] = useState<Set<number>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copiedImageId, setCopiedImageId] = useState<number | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const animateObserverRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryContainerRef = useRef<HTMLDivElement>(null);
  const loadImagesRef = useRef<(() => void) | null>(null);

  const [hashLength, setHashLength] = useState<number>(2);
  const [fileExt, setFileExt] = useState<string>(".jpg");
  const [serverAspect, setServerAspect] = useState<string | undefined>(undefined);

  const IMAGES_PER_PAGE = 20;

  // False during SSR and hydration, true afterwards. Keeps the first client
  // render identical to the server's without calling setState inside an effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const getColumnCount = (typeStr: string) => {
    if (typeStr === "gif" || folder === "gif") return 5;
    if (typeof window === "undefined") return 3;
    const width = window.innerWidth;
    if (width < 768) return 2;
    if (width < 1024) return 3;
    return 4;
  };

    const typeToFolder: Record<string, string> = {
    horizontal: "h",
    vertical: "v",
    avatar: "a",
    gif: "gif",
    };

    const folder = typeToFolder[type] || type;

    // 优先采用从 counts.json 自动嗅探计算的比例；无配置时回退到默认比例
    const aspectRatio = serverAspect !== undefined ? serverAspect : (
      (type === "h" || type === "horizontal") ? "4/3" :
      (type === "v" || type === "vertical") ? "9/16" :
      (type === "a" || type === "avatar") ? "1/1" :
      undefined
    );

    const imgWidth = 800;
    const imgHeight = 800;


  useEffect(() => {
    const fetchMaxCount = async () => {
      try {
        const response = await fetch("/counts.json");
        const data = await response.json();
        const displayCounts = data.real_counts || data.counts;
        const count = displayCounts[folder] ?? 0;

        setHashLength(data.hash_length || 3);

        if (data.category_exts && data.category_exts[folder]) {
          setFileExt(data.category_exts[folder]);
        } else {
          setFileExt(data.output_ext || ".jpg");
        }

        // 动态读取服务端 Python 自动嗅探提取的真实比例
        if (data.category_aspects && folder in data.category_aspects) {
          setServerAspect(data.category_aspects[folder] || undefined);
        } else if (Array.isArray(data.categories)) {
          const found = data.categories.find((c: { key: string; aspect?: string | null }) => c.key === folder);
          setServerAspect(found?.aspect || undefined);
        }

        setMaxCount(count);
        setCountsLoaded(true);
      } catch {
        setCountsLoaded(true);
      }
    };
    fetchMaxCount();
  }, [type, folder]);

  const loadImages = useCallback(() => {
    if (loading || !countsLoaded || maxCount === 0) return;

    const startId = (page - 1) * IMAGES_PER_PAGE;
    const endId = Math.min(page * IMAGES_PER_PAGE - 1, maxCount - 1);

    if (startId >= maxCount) return;

    setLoading(true);

    const newImages: ImageItem[] = [];

    for (let i = startId; i <= endId; i++) {
      const hexName = i.toString(16).padStart(hashLength, "0") + fileExt;

      newImages.push({
        id: i,
        url: `/${folder}/${hexName}`,
      });
    }

    setImages((prev) => [...prev, ...newImages]);
    setPage((prev) => prev + 1);
    setLoading(false);
  }, [page, loading, maxCount, countsLoaded, hashLength, fileExt, folder]);

  // Keep the ref pointing at the latest callback for the observers below.
  // It cannot be assigned during render, and an effect still runs before any
  // observer callback fires.
  useEffect(() => {
    loadImagesRef.current = loadImages;
  }, [loadImages]);

  // No reset-on-type effect is needed here: app/page.tsx renders this component
  // with key={galleryType}, so switching category remounts it with fresh state.

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleImageError = (imageId: number) => {
    setImageErrors((prev) => new Set(prev).add(imageId));
  };

  const handleImageLoad = (imageId: number) => {
    setImageLoaded((prev) => new Set(prev).add(imageId));
  };

  const handleCopyDirectUrl = useCallback(async (imageUrl: string, id: number) => {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "https://img.srprolin.com";
    const fullUrl = imageUrl.startsWith("http") ? imageUrl : `${origin}${imageUrl}`;

    let success = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(fullUrl);
        success = true;
      } catch {
        // fallback below
      }
    }

    if (!success && typeof document !== "undefined") {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = fullUrl;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        success = true;
      } catch (e) {
        console.error("Copy fallback failed:", e);
      }
    }

    if (success) {
      setCopiedImageId(id);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedImageId(null);
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

  useEffect(() => {
    if (
      countsLoaded &&
      maxCount > 0 &&
      !initialLoadDone.current &&
      images.length === 0
    ) {
      initialLoadDone.current = true;
      loadImagesRef.current?.();
    }
  }, [countsLoaded, maxCount, images.length]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loading &&
          (page - 1) * IMAGES_PER_PAGE < maxCount
        ) {
          loadImagesRef.current?.();
        }
      },
      { threshold: 0.5 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, page, maxCount]);

  useEffect(() => {
    // Capture the node so the cleanup below unbinds the same element.
    const container = galleryContainerRef.current;
    if (!container) return;

    const options: FancyboxBindOptions = {
      Thumbs: {
        type: "classic",
      },
      Toolbar: {
        display: {
          left: ["infobar"],
          middle: [
            "zoomIn",
            "zoomOut",
            "toggle1to1",
            "rotateCCW",
            "rotateCW",
            "flipX",
            "flipY",
          ],
          right: ["slideshow", "fullscreen", "download", "thumbs", "close"],
        },
      },
    };

    Fancybox.bind(container, "[data-fancybox]", options);

    return () => {
      Fancybox.unbind(container);
    };
  }, [images]);

  // Scroll-in animation observer
  useEffect(() => {
    if (animateObserverRef.current) {
      animateObserverRef.current.disconnect();
    }

    animateObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            // Use rAF to ensure initial state is rendered before transition
            requestAnimationFrame(() => {
              el.classList.remove("opacity-0", "translate-y-4", "transition-none");
              el.classList.add("opacity-100", "translate-y-0", "transition-all", "duration-500", "ease-out");
            });
            animateObserverRef.current?.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe all cards marked with data-animate
    const cards = containerRef.current?.querySelectorAll("[data-animate]");
    cards?.forEach((card) => {
      animateObserverRef.current?.observe(card);
    });

    return () => {
      animateObserverRef.current?.disconnect();
    };
  }, [images, mounted]);

  const renderMasonryLayout = () => {
    const columnCount = mounted
      ? getColumnCount(type)
      : (type === "gif" || folder === "gif" ? 5 : 3);
    const columns: ImageItem[][] = Array.from(
      { length: columnCount },
      () => []
    );

    images.forEach((image, index) => {
      const columnIndex = index % columnCount;
      columns[columnIndex].push(image);
    });

    return (
      <div className="flex gap-4 w-full" ref={containerRef}>
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-4 flex-1">
            {column.map((image, indexInSection) => (
              <div
                key={`${type}-${image.id}`}
                data-animate
                className="group relative overflow-hidden rounded-lg bg-muted opacity-0 translate-y-4 transition-none"
                style={{ transitionDelay: `${(indexInSection % 6) * 80}ms` }}
              >
                {imageErrors.has(image.id) ? (
                  <div
                    className="relative overflow-hidden rounded-lg bg-muted flex items-center justify-center aspect-square"
                    style={aspectRatio ? { aspectRatio } : undefined}
                  >
                    <Image
                      src="/placeholder.svg"
                      alt={`占位图 #${image.id}`}
                      width={imgWidth}
                      height={imgHeight}
                      className="w-full h-full object-cover opacity-60"
                      style={aspectRatio ? { aspectRatio } : undefined}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground/80 font-mono bg-background/80 px-2 py-0.5 rounded shadow-xs">
                        #{image.id} 占位图
                      </span>
                    </div>
                  </div>
                ) : (
                  <a
                    data-fancybox="gallery"
                    href={image.url}
                    data-caption={`#${image.id}`}
                    className="w-full cursor-zoom-in block"
                  >
                    <Image
                      src={image.url || "/placeholder.svg"}
                      alt={`Gallery image ${image.id}`}
                      width={imgWidth}
                      height={imgHeight}
                      className={`
                        w-full object-cover
                        transition-all duration-500 ease-out transform-gpu will-change-transform
                        group-hover:scale-105
                        ${imageLoaded.has(image.id) ? "scale-100 blur-0" : "scale-105 blur-xl"}
                      `}
                      style={aspectRatio ? { aspectRatio } : undefined}
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      loading={image.id < IMAGES_PER_PAGE ? "eager" : "lazy"}
                      priority={image.id < 8}
                      onError={() => handleImageError(image.id)}
                      onLoad={() => handleImageLoad(image.id)}
                    />
                  </a>
                )}

                {!imageErrors.has(image.id) && (
                  <>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />
                    <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm text-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      #{image.id}
                    </div>

                    {/* 左上角复制直链按钮（移动端常驻微透明，桌面端悬停浮现） */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopyDirectUrl(image.url, image.id);
                      }}
                      className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background/90 hover:bg-background text-foreground text-xs font-medium backdrop-blur-md shadow-xs opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-all duration-200 cursor-pointer border border-border/40"
                      title="复制图片直链"
                      aria-label={`复制图片 #${image.id} 直链`}
                    >
                      {copiedImageId === image.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-[11px]">复制直链</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="w-full" ref={galleryContainerRef}>
      {renderMasonryLayout()}

      <div ref={loadMoreRef} className="flex justify-center py-8">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span>加载中...</span>
          </div>
        )}
        {countsLoaded && maxCount === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Copy className="w-5 h-5 opacity-40" />
            </div>
            <p className="text-base font-medium text-foreground">该分类暂无有效图片素材</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              请检查 <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">oriImg/{folder}/</code> 目录是否存在且包含单张体积 ≤ 5MB 的图片，随后执行构建。
            </p>
          </div>
        )}
        {(page - 1) * IMAGES_PER_PAGE >= maxCount &&
          !loading &&
          maxCount > 0 && (
            <p className="text-muted-foreground text-sm">
              已加载全部 {maxCount} 张图片
            </p>
          )}
      </div>

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring z-50"
          aria-label="回到顶部"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
