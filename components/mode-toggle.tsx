'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useI18n } from '@/lib/i18n'

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useI18n()

  // False during SSR and hydration, true afterwards — the same gate the
  // previous `mounted` state provided, without a setState inside an effect.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) {
    return <div className="size-9" /> // Placeholder to avoid layout shift
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      title={t.nav.switchTheme}
      aria-label={t.nav.switchTheme}
      className="inline-flex items-center justify-center rounded-lg size-9 text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    >
      {resolvedTheme === 'dark' ? (
        <Moon className="size-[18px]" aria-hidden="true" />
      ) : (
        <Sun className="size-[18px]" aria-hidden="true" />
      )}
    </button>
  )
}
