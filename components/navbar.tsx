"use client";

import { useState, useEffect, useRef } from "react";
import Link, { useLinkStatus } from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/mode-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useI18n } from "@/lib/i18n";
import {
  Github,
  Image as ImageIcon,
  LoaderCircle,
  Menu,
  SlidersHorizontal,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

/** Scroll offset past which the floating bar turns into a solid capsule. */
const MORPH_AT = 20;
/** Below this offset the bar stays visible, so short pages never lose it. */
const HIDE_AFTER = 350;

function NavLabel({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? (
        <LoaderCircle className="size-3.5 animate-spin sm:size-4" aria-hidden="true" />
      ) : (
        <Icon className="size-3.5 sm:size-4" aria-hidden="true" />
      )}
      <span>{label}</span>
      <span className={`nav-pending ${pending ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
    </>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [retracted, setRetracted] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);
  const lastY = useRef(0);
  const menuOpenRef = useRef(false);

  // Close mobile menu on route changes without cascading effect updates
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    menuOpenRef.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > MORPH_AT);

      if (reducedMotion.matches || menuOpenRef.current) {
        setRetracted(false);
      } else {
        setRetracted(y > HIDE_AFTER && y > lastY.current);
      }

      lastY.current = y;
    };

    lastY.current = window.scrollY;
    const rafId = window.requestAnimationFrame(onScroll);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const navLinks = [
    { href: "/", label: t.nav.home, icon: Sparkles },
    { href: "/gallery", label: t.nav.gallery, icon: ImageIcon },
    { href: "/settings", label: t.nav.settings, icon: SlidersHorizontal },
  ];

  const isLinkActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isRetracted = retracted && !mobileMenuOpen;

  return (
    <header
      className="site-header sticky top-2 sm:top-4 z-50 pointer-events-none"
      data-scrolled={scrolled}
      data-retracted={isRetracted}
      data-menu={mobileMenuOpen ? "open" : "closed"}
    >
      <a href="#main-content" className="skip-link pointer-events-auto">
        {t.nav.skipToContent}
      </a>

      <div className="container mx-auto px-4 max-w-6xl">
        <div className="site-header-capsule pointer-events-auto relative flex h-14 items-center justify-between rounded-xl sm:rounded-2xl border border-transparent px-2.5 sm:px-4">
          {/* Brand: Logo & Title */}
          <Link
            href="/"
            className="site-brand site-header-brand flex shrink-0 select-none items-center gap-2.5 rounded-lg py-1 transition-colors"
          >
            <Image
              src="/icon.svg"
              alt=""
              width={36}
              height={36}
              className="size-8 sm:size-9"
              priority
            />
            <span className="text-base sm:text-lg font-semibold tracking-tight">SrP-IMG</span>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label={t.nav.primary} className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                    active
                      ? "bg-muted/80 text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <NavLabel label={link.label} icon={link.icon} />
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Control Cluster: Language, GitHub, Theme, Mobile Hamburger */}
          <div className="site-header-cluster flex items-center gap-1">
            <LangToggle />
            <a
              href="https://github.com/RolinShmily/SrP-IMG"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              title={t.nav.github}
              aria-label={t.nav.github}
            >
              <Github className="size-[18px]" aria-hidden="true" />
            </a>
            <ModeToggle />
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((open) => {
                  if (!open) setRetracted(false);
                  return !open;
                });
              }}
              className="inline-flex size-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-muted hover:text-foreground sm:hidden"
              aria-label={mobileMenuOpen ? t.nav.closeMenu : t.nav.menu}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-panel"
            >
              {mobileMenuOpen ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Menu className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Mobile Dropdown Panel */}
          <div
            id="mobile-navigation-panel"
            className="site-header-panel absolute inset-x-0 top-full mt-2 sm:hidden pointer-events-auto"
            inert={!mobileMenuOpen}
          >
            <div className="rounded-2xl border border-border bg-card/98 backdrop-blur-xl p-2.5 shadow-2xl space-y-1">
              {navLinks.map((link) => {
                const active = isLinkActive(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
