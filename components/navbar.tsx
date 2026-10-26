"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/mode-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useI18n } from "@/lib/i18n";
import { Sparkles, Image as ImageIcon, SlidersHorizontal } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { t } = useI18n();

  const navLinks = [
    { href: "/", label: t.nav.home, icon: Sparkles },
    { href: "/gallery", label: t.nav.gallery, icon: ImageIcon },
    { href: "/settings", label: t.nav.settings, icon: SlidersHorizontal },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors duration-200">
      <div className="container mx-auto px-4 py-3.5 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo / Brand */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none select-none"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/80 dark:border-white/20 p-0.5 bg-card shadow-xs group-hover:border-primary/40 group-hover:shadow-sm transition-all duration-200 overflow-hidden shrink-0 flex items-center justify-center">
                <Image
                  src="/icon.svg"
                  alt="SrP-IMG Logo"
                  width={36}
                  height={36}
                  className="w-full h-full rounded-[9px] group-hover:scale-105 transition-transform duration-200 transform-gpu"
                  priority
                />
              </div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-sans">
                SrP-IMG
              </span>
            </Link>

            {/* 主导航链接 */}
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* 右侧功能按钮：移动端紧凑导航、语言切换、主题切换、GitHub */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 移动端迷你导航栏 */}
            <div className="flex sm:hidden items-center gap-1 mr-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* 语言切换 */}
            <LangToggle />

            {/* GitHub 图标 */}
            <a
              href="https://github.com/RolinShmily/SrP-IMG"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground/80 hover:text-foreground"
              title={t.nav.github}
              aria-label="GitHub Repository"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
            </a>

            {/* 明暗模式切换 */}
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
