"use client";

import Link, { useLinkStatus } from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/mode-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useI18n } from "@/lib/i18n";
import { Github, Image as ImageIcon, LoaderCircle, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";

function NavLabel({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? <LoaderCircle className="size-3.5 animate-spin sm:size-4" aria-hidden="true" /> : <Icon className="size-3.5 sm:size-4" aria-hidden="true" />}
      <span>{label}</span>
      <span className={`nav-pending ${pending ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
    </>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const navLinks = [
    { href: "/", label: t.nav.home, icon: Sparkles },
    { href: "/gallery", label: t.nav.gallery, icon: ImageIcon },
    { href: "/settings", label: t.nav.settings, icon: SlidersHorizontal },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
      <a href="#main-content" className="skip-link">{t.nav.skipToContent}</a>
      <div className="container mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:gap-x-6 sm:py-3.5">
        <Link href="/" className="flex shrink-0 select-none items-center gap-2.5 rounded-lg">
          <Image src="/icon.svg" alt="" width={40} height={40} className="size-9 sm:size-10" priority />
          <span className="text-lg sm:text-xl font-semibold tracking-tight">SrP-IMG</span>
        </Link>
        <nav aria-label={t.nav.primary} className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-3 sm:text-sm ${isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
              >
                <NavLabel label={link.label} icon={link.icon} />
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LangToggle />
          <a href="https://github.com/RolinShmily/SrP-IMG" target="_blank" rel="noopener noreferrer" className="inline-flex size-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-muted hover:text-foreground" title={t.nav.github} aria-label={t.nav.github}>
            <Github className="size-[18px]" aria-hidden="true" />
          </a>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
