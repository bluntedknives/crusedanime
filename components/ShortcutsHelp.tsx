'use client'

import { useEffect, useState } from 'react'
import { IconClose, IconKeyboard } from './icons'

const SHORTCUTS: { group: string; items: { keys: string[]; label: string }[] }[] = [
  {
    group: 'Anywhere',
    items: [
      { keys: ['⌘', 'K'], label: 'Open the command palette' },
      { keys: ['/'], label: 'Focus search' },
      { keys: ['?'], label: 'Show this dialog' },
      { keys: ['G', 'H'], label: 'Go home' },
      { keys: ['G', 'B'], label: 'Go to browse' },
      { keys: ['G', 'W'], label: 'Go to watchlist' },
      { keys: ['G', 'S'], label: 'Go to schedule' },
    ],
  },
  {
    group: 'Player',
    items: [
      { keys: ['Space'], label: 'Play / pause' },
      { keys: ['←', '→'], label: 'Seek 5 seconds' },
      { keys: ['J', 'L'], label: 'Seek 10 seconds' },
      { keys: ['↑', '↓'], label: 'Volume' },
      { keys: ['M'], label: 'Mute' },
      { keys: ['F'], label: 'Fullscreen' },
      { keys: ['C'], label: 'Subtitles' },
      { keys: ['N'], label: 'Next episode' },
      { keys: ['<', '>'], label: 'Playback speed' },
    ],
  },
]

/**
 * Keyboard shortcut reference, opened with `?`.
 *
 * The shortcuts are declared here rather than in each component so this dialog
 * cannot drift out of sync with what actually works — it is the documentation
 * of record.
 */
export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing) return
      if (e.key === '?') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-base-850/98 p-5 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconKeyboard size={17} className="text-accent" />
            <h2 className="font-display text-base font-semibold text-zinc-100">Keyboard shortcuts</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="btn-icon h-7 w-7">
            <IconClose size={15} />
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {SHORTCUTS.map((section) => (
            <div key={section.group}>
              <p className="eyebrow mb-2">{section.group}</p>
              <ul className="space-y-1.5">
                {section.items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-400">{s.label}</span>
                    <span className="flex shrink-0 gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="min-w-[1.4rem] rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-center font-mono text-[0.62rem] text-zinc-300"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
