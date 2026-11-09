'use client'

import { useEffect } from 'react'
import { IconClose, IconInstall } from './icons'
import { usePrefs, useViewMode } from '@/lib/store'
import { CoverToggle } from './CoverClient'
import AdsToggle from './ads/AdsToggle'
import BackupPanel from './BackupPanel'
import { openInstallDialog } from './InstallDialog'
import { useInstallPrompt } from '@/lib/pwa'

interface Props {
  open: boolean
  onClose: () => void
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span className="min-w-0">
        <span className="block text-sm text-zinc-200">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>}
      </span>
      <span
        className={[
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          value ? 'bg-accent' : 'bg-white/15',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            value ? 'translate-x-[1.15rem]' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

export default function SettingsDialog({ open, onClose }: Props) {
  const { prefs, update } = usePrefs()
  const { mode, setMode } = useViewMode()
  const { installed } = useInstallPrompt()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="surface-raised relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden shadow-2xl animate-scale-in"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
          <button type="button" onClick={onClose} className="btn-icon h-8 w-8" aria-label="Close settings">
            <IconClose size={16} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <p className="px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-600">
            Playback
          </p>
          <div className="px-3 pb-2">
            <span className="label">Preferred audio</span>
            <div className="flex gap-1.5">
              {(['sub', 'dub'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update({ preferredType: t })}
                  className={[
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors',
                    prefs.preferredType === t
                      ? 'border-accent/50 bg-accent/15 text-accent-soft'
                      : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Autoplay"
            hint="Start playing as soon as the stream resolves"
            value={prefs.autoPlay}
            onChange={(v) => update({ autoPlay: v })}
          />
          <Toggle
            label="Autoplay next episode"
            hint="Jump to the next episode when one ends"
            value={prefs.autoNext}
            onChange={(v) => update({ autoNext: v })}
          />
          <Toggle
            label="Skip intro automatically"
            hint="Seek past the opening when a timestamp is available"
            value={prefs.skipIntro}
            onChange={(v) => update({ skipIntro: v })}
          />
          <CoverToggle />
          <AdsToggle />

          <Toggle
            label="Subtitles on by default"
            value={prefs.subtitlesOn}
            onChange={(v) => update({ subtitlesOn: v })}
          />

          <p className="mt-2 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-600">
            Downloads
          </p>
          <div className="px-3 pb-3">
            <span className="label">Storage cap</span>
            <p className="mb-2 text-xs text-zinc-500">
              Stop new downloads once this much is saved. Does not delete anything.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[0, 1_000, 2_000, 5_000, 10_000, 20_000].map((mb) => (
                <button
                  key={mb}
                  type="button"
                  onClick={() => update({ downloadCapMb: mb })}
                  className={[
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    (prefs.downloadCapMb ?? 0) === mb
                      ? 'border-accent/50 bg-accent/15 text-accent-soft'
                      : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  {mb === 0 ? 'Off' : mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-2 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-600">
            Appearance
          </p>
          <div className="px-3 pb-3">
            <span className="label">Default layout</span>
            <div className="flex gap-1.5">
              {(['grid', 'list'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={[
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors',
                    mode === m
                      ? 'border-accent/50 bg-accent/15 text-accent-soft'
                      : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-2 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-600">
            App
          </p>
          <div className="px-3 pb-3">
            {installed ? (
              <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-500">
                Installed — launch crused from your home screen or app list.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => openInstallDialog()}
                className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-left text-sm text-zinc-200 transition-colors hover:bg-white/[0.06]"
              >
                <IconInstall size={16} className="text-accent-soft" />
                <span className="min-w-0">
                  <span className="block">Install app</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Full-screen, works offline
                  </span>
                </span>
              </button>
            )}
          </div>

          <p className="mt-2 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-600">
            Your data
          </p>
          <BackupPanel />
        </div>
      </div>
    </div>
  )
}
