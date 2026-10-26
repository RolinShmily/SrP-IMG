import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/lib/i18n'
import './globals.css'

// Next.js requires font loaders to be bound to a const, and the families are
// applied through the `--font-sans` / `--font-mono` variables in globals.css,
// so these bindings are intentionally unreferenced (hence the `_` prefix).
const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});
const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SrP-IMG — 全功能随机图片 API & 画廊',
  description: '基于 Cloudflare Workers 与 Next.js 构建的无限流量、零成本、多分类随机图片解决方案与现代化瀑布流画廊。',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen selection:bg-primary/10">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            {children}
          </I18nProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
