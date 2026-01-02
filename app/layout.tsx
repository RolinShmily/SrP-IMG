import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

const siteAvatarUrl = "https://q1.qlogo.cn/g?b=qq&nk=1608219667&s=640";

export const metadata: Metadata = {
  title: 'SrP-IMG Gallery',
  description: 'Created with v0',
  generator: 'v0.app',
  icons: {
    icon: siteAvatarUrl,
    shortcut: siteAvatarUrl,
    apple: siteAvatarUrl,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
