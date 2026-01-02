"use client"
import { useState } from "react"
import { ImageGallery } from "@/components/image-gallery"
import { ModeToggle } from "@/components/mode-toggle"

export default function Home() {
  const [galleryType, setGalleryType] = useState<"horizontal" | "vertical">("horizontal")

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-serif font-bold tracking-tight text-balance">SrP-IMG Gallery</h1>

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
              </div>
              <ModeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ImageGallery key={galleryType} type={galleryType} />
      </main>
    </div>
  )
}
