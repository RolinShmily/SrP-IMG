"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  GitFork,
  PackageOpen,
  Rss,
  Scale,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const REPOSITORY = "https://github.com/RolinShmily/SrP-IMG";
const RELEASES = `${REPOSITORY}/releases`;
const DOCS = `${REPOSITORY}#readme`;
const BLOG = "https://blog.srprolin.com";
const LICENSE = `${REPOSITORY}/blob/main/LICENSE`;

export function Footer() {
  const { t } = useI18n();
  const pathname = usePathname();

  const links = [
    { label: t.footer.project, url: REPOSITORY, icon: GitFork },
    { label: t.footer.docs, url: DOCS, icon: BookOpen },
    { label: t.footer.releases, url: RELEASES, icon: PackageOpen },
    { label: t.footer.blog, url: BLOG, icon: Rss },
  ];

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBrandClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/") {
      e.preventDefault();
      scrollToTop();
    }
  };

  return (
    <footer className="mt-auto border-t border-border/50 text-xs text-muted-foreground transition-colors">
      <div className="container mx-auto px-4 max-w-6xl py-8 space-y-6">
        {/* Top Row: Brand, Tagline & Essential Links */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Link
              href="/"
              onClick={handleBrandClick}
              className="inline-flex items-center gap-2 select-none font-semibold text-sm text-foreground hover:opacity-80 transition-opacity"
            >
              <Image
                src="/icon.svg"
                alt="SrP-IMG Logo"
                width={22}
                height={22}
                className="size-5 sm:size-5.5 rounded-md shrink-0"
              />
              <span>SrP-IMG</span>
            </Link>
            <span className="hidden sm:inline text-border" aria-hidden="true">·</span>
            <p className="text-xs text-muted-foreground">
              {t.footer.description}
            </p>
          </div>

          <nav
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"
            aria-label={t.footer.project}
          >
            {links.map(({ label, url, icon: Icon }) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon
                  className="size-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors shrink-0"
                  aria-hidden="true"
                />
                <span>{label}</span>
                <ArrowUpRight
                  className="size-3 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0"
                  aria-hidden="true"
                />
              </a>
            ))}
          </nav>
        </div>

        {/* Bottom Row: Copyright, License & Back to Top */}
        <div className="border-t border-border/30 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] sm:text-xs text-muted-foreground/80">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span>© 2025–2026 RoL1n_SrP</span>
            <span className="text-border" aria-hidden="true">·</span>
            <a
              href={LICENSE}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Scale
                className="size-3 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0"
                aria-hidden="true"
              />
              <span>{t.footer.license}</span>
              <ArrowUpRight
                className="size-2.5 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0"
                aria-hidden="true"
              />
            </a>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="group inline-flex items-center gap-1 self-start sm:self-auto hover:text-foreground transition-colors cursor-pointer"
          >
            <span>{t.footer.top}</span>
            <ArrowUp
              className="size-3 text-muted-foreground/60 group-hover:text-foreground group-hover:-translate-y-0.5 transition-all shrink-0"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </footer>
  );
}
