"use client";
import { useState } from "react";
import { ImageGallery } from "@/components/image-gallery";
import { ModeToggle } from "@/components/mode-toggle";

// 定义一个类型方便管理
type GalleryCategory = "horizontal" | "vertical" | "avatar" | "gif";

export default function Home() {
  const [galleryType, setGalleryType] = useState<GalleryCategory>("horizontal");

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-serif font-bold tracking-tight text-balance">
              SrP-IMG Gallery
            </h1>

            <div className="flex items-center gap-4">
              <div className="flex gap-2 rounded-lg bg-muted p-1">
                <button
                  onClick={() => setGalleryType("horizontal")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    galleryType === "horizontal"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  横屏
                </button>
                <button
                  onClick={() => setGalleryType("vertical")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    galleryType === "vertical"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  竖屏
                </button>
                {/* 新增头像按钮 */}
                <button
                  onClick={() => setGalleryType("avatar")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    galleryType === "avatar"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  头像
                </button>
                {/* 新增 GIF 按钮 */}
                <button
                  onClick={() => setGalleryType("gif")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    galleryType === "gif"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  GIF
                </button>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href="https://github.com/RolinShmily/SrP-IMG"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md hover:bg-muted transition-colors text-foreground/80 hover:text-foreground"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                  </svg>
                </a>
                <ModeToggle />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ImageGallery key={galleryType} type={galleryType} />
      </main>
    </div>
  );
}
