'use client'

import { useEffect, useState } from 'react'
import { IconClose, IconInstall, IconShare, IconPlus } from './icons'
import { useInstallPrompt } from '@/lib/pwa'

/** Fired by any button that should open the install dialog. */
export const INSTALL_EVENT = 'crused:install'

/** Open the install dialog from anywhere. */
export function openInstallDialog() {
  window.dispatchEvent(new Event(INSTALL_EVENT))
}

function Step({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-2.5 text-sm text-zinc-300">{children}</li>
}

/**
 * Install instructions and the native prompt.
 *
 * Three states: a native prompt (Chromium), iOS Safari steps, or a generic
 * "your browser menu" fallback. Mounted once in the layout and opened by the
 * `INSTALL_EVENT` so every entry point shares one dialog.
 */
export default function InstallDialog() {
  const [open, setOpen] = useState(false)
  const { canInstall, needsIOSInstructions, installed, promptInstall } = useInstallPrompt()

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(INSTALL_EVENT, onOpen)
    return () => window.removeEventListener(INSTALL_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const close = () => setOpen(false)

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install app"
        className="surface-raised relative z-10 w-full max-w-md overflow-hidden pb-[env(safe-area-inset-bottom)] shadow-2xl animate-scale-in"
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <IconInstall size={16} className="text-accent-soft" />
            Install crused
          </h2>
          <button type="button" onClick={close} className="btn-icon h-8 w-8" aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {installed ? (
            <p className="text-sm text-zinc-300">
              This app is already installed. Launch it from your home screen or
              app list.
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-400">
                Install crused for a full-screen, app-like experience with quick
                access from your home screen — it works offline too.
              </p>

              {canInstall && (
                <button
                  type="button"
                  onClick={() => promptInstall().then(close)}
                  className="btn-primary h-11 w-full"
                >
                  <IconInstall size={16} />
                  Install now
                </button>
              )}

              {needsIOSInstructions && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                  <p className="mb-2.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-500">
                    On iPhone / iPad (Safari)
                  </p>
                  <ol className="space-y-2.5">
                    <Step>
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/10 text-zinc-200">
                        <IconShare size={12} />
                      </span>
                      Tap the <span className="font-semibold text-zinc-100">Share</span> button in
                      Safari&rsquo;s toolbar.
                    </Step>
                    <Step>
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/10 text-zinc-200">
                        <IconPlus size={12} />
                      </span>
                      Choose <span className="font-semibold text-zinc-100">Add to Home Screen</span>.
                    </Step>
                    <Step>
                      <span className="mt-0.5 h-5 w-5 shrink-0 text-center text-zinc-500">3</span>
                      Tap <span className="font-semibold text-zinc-100">Add</span>. The app opens
                      full-screen from your home screen.
                    </Step>
                  </ol>
                  <p className="mt-3 text-xs text-zinc-500">
                    On iOS this only works in Safari — not Chrome or Firefox.
                  </p>
                </div>
              )}

              {!canInstall && !needsIOSInstructions && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-sm text-zinc-400">
                  Open your browser menu and choose{' '}
                  <span className="font-semibold text-zinc-200">Install app</span> or{' '}
                  <span className="font-semibold text-zinc-200">Add to Home Screen</span>.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
