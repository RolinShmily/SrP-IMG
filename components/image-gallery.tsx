"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { Fancybox } from "@fancyapps/ui"
import "@fancyapps/ui/dist/fancybox/fancybox.css"

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

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryContainerRef = useRef<HTMLDivElement>(null);
  const loadImagesRef = useRef<(() => void) | null>(null);

  const [hashLength, setHashLength] = useState<number>(3);
  const [fileExt, setFileExt] = useState<string>(".jpg");

    const IMAGES_PER_PAGE = 20;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const getColumnCount = () => {
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

        setMaxCount(count);
        setCountsLoaded(true);
      } catch (error) {
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

  // Keep ref updated
  loadImagesRef.current = loadImages;

  useEffect(() => {
    setImages([]);
    setPage(1);
    setLoading(false);
    setCountsLoaded(false);
    setMaxCount(0);
    setImageErrors(new Set());
    setImageLoaded(new Set());
    setShowScrollTop(false);
    initialLoadDone.current = false;
  }, [type]);

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
    if (galleryContainerRef.current) {
      Fancybox.bind(galleryContainerRef.current, "[data-fancybox]", {
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
      } as any);
    }

    return () => {
      if (galleryContainerRef.current) {
        Fancybox.unbind(galleryContainerRef.current);
      }
    };
  }, [images]);

  const renderMasonryLayout = () => {
    const columnCount = mounted ? getColumnCount() : 3;
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
            {column.map((image) => (
              <div
                key={`${type}-${image.id}`}
                className="group relative overflow-hidden rounded-lg bg-muted"
              >
                {!imageLoaded.has(image.id) && !imageErrors.has(image.id) && (
                  <div className="absolute inset-0 bg-muted/20 animate-pulse" />
                )}

                {imageErrors.has(image.id) ? (
                  <div className="aspect-square flex items-center justify-center text-muted-foreground">
                    <span className="text-sm">加载失败</span>
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
                      width={800}
                      height={600}
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
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
