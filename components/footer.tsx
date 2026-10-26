"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border/60 py-8 bg-muted/20 text-xs text-muted-foreground mt-auto">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground font-sans">SrP-IMG</span>
          <span>·</span>
          <span>{t.home.badge}</span>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">
            {t.nav.home}
          </Link>
          <Link href="/gallery" className="hover:text-foreground transition-colors">
            {t.nav.gallery}
          </Link>
          <Link href="/settings" className="hover:text-foreground transition-colors">
            {t.nav.settings}
          </Link>
          <a
            href="https://github.com/RolinShmily/SrP-IMG"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
