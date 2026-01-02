"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { Fancybox } from "@fancyapps/ui"
import "@fancyapps/ui/dist/fancybox/fancybox.css"

interface ImageGalleryProps {
  type: "horizontal" | "vertical"
}

interface ImageItem {
  id: number
  url: string
}

export function ImageGallery({ type }: ImageGalleryProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [maxCount, setMaxCount] = useState<number>(0);
  const [countsLoaded, setCountsLoaded] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const fetchMaxCount = async () => {
        try {
        const response = await fetch("/counts.json");
        const data = await response.json();

        const displayCounts = data.real_counts || data.counts;
        const count = type === "horizontal" ? displayCounts.h : displayCounts.v;

        setMaxCount(count);
        setHashLength(data.hash_length || 3);
        setFileExt(data.output_ext || ".jpg");
        setCountsLoaded(true);
        } catch (error) {
        }
    };
    fetchMaxCount();
  }, [type]);

  const loadImages = useCallback(() => {
    if (loading || !countsLoaded || maxCount === 0) return;

    const startId = (page - 1) * IMAGES_PER_PAGE;
    const endId = Math.min(page * IMAGES_PER_PAGE - 1, maxCount - 1);

    if (startId >= maxCount) return;

    setLoading(true);

    const newImages: ImageItem[] = [];
    const folder = type === "horizontal" ? "h" : "v";

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
  }, [page, loading, type, maxCount, countsLoaded, hashLength, fileExt]);

  useEffect(() => {
    setImages([]);
    setPage(1);
    setLoading(false);
    initialLoadDone.current = false;
  }, [type]);

  useEffect(() => {
    if (
      countsLoaded &&
      maxCount > 0 &&
      !initialLoadDone.current &&
      images.length === 0
    ) {
      initialLoadDone.current = true;
      loadImages();
    }
  }, [countsLoaded, maxCount, images.length, loadImages]);

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
          loadImages();
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
  }, [loading, page, loadImages, maxCount]);

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
                    loading="lazy"
                  />
                </a>

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />

                <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm text-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  #{image.id}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
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
    </div>
  );
}
