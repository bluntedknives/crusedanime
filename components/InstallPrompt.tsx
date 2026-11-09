'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { IconClose, IconInstall } from './icons'
import { openInstallDialog } from './InstallDialog'
import { useInstallPrompt } from '@/lib/pwa'

const DISMISS_KEY = 'crused:install-dismissed'

/**
 * A single, dismissible install nudge on mobile.
 *
 * Shown only when the app is actually installable (a native prompt exists, or
 * iOS Safari where it can be added by hand), only on small screens, and never
 * on the watch route where the player owns the screen. Dismissing is permanent
 * — a re-prompt is the fastest way to annoy a returning viewer.
 */
export default function InstallPrompt() {
  const pathname = usePathname()
  const { canInstall, needsIOSInstructions, installed } = useInstallPrompt()
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const go = () => {
      try {
        setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
      } catch {
        setDismissed(false)
      }
      setReady(true)
    }
    // Wait until the page is settled before asking for anything.
    const t = window.setTimeout(go, 4000)
    return () => window.clearTimeout(t)
  }, [])

  const onWatch = pathname?.startsWith('/watch') ?? false

  if (!ready || dismissed || installed) return null
  if (!canInstall && !needsIOSInstructions) return null
  if (onWatch) return null

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[55] lg:hidden">
      <div className="surface-raised flex items-center gap-3 p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-black">
          <IconInstall size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">Install crused</p>
          <p className="truncate text-xs text-zinc-500">Full-screen app with offline access</p>
        </div>
        <button
          type="button"
          onClick={() => openInstallDialog()}
          className="btn-primary h-9 shrink-0 px-3.5 text-xs"
        >
          Install
        </button>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={() => {
            setDismissed(true)
            try {
              localStorage.setItem(DISMISS_KEY, '1')
            } catch {
              /* ignore */
            }
          }}
          className="btn-icon h-8 w-8 shrink-0"
        >
          <IconClose size={15} />
        </button>
      </div>
    </div>
  )
}
