'use client'

import { useState } from 'react'
import { titleOf, type Media } from '@/lib/anilist'
import { useWatchlist, type WatchStatus } from '@/lib/store'

const STATUSES: { value: WatchStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'planned', label: 'Plan to watch' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'On hold' },
  { value: 'dropped', label: 'Dropped' },
]

interface Props {
  media: Media
  size?: 'sm' | 'md' | 'lg'
  showStatusMenu?: boolean
  className?: string
}

export default function WatchlistButton({
  media,
  size = 'md',
  showStatusMenu = true,
  className = '',
}: Props) {
  const { has, toggle, entries, setStatus } = useWatchlist()
  const [menuOpen, setMenuOpen] = useState(false)

  const entry = entries.find((e) => e.id === media.id)
  const inList = has(media.id)
  const label = titleOf(media)

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  }[size]

  const current = STATUSES.find((s) => s.value === entry?.status)

  return (
    <div className={`relative inline-flex ${className}`}>
      <div className="flex overflow-hidden rounded-lg">
        <button
          type="button"
          onClick={() => toggle(media)}
          aria-pressed={inList}
          aria-label={inList ? `Remove ${label} from watchlist` : `Add ${label} to watchlist`}
          className={[
            'inline-flex items-center gap-2 font-medium transition',
            sizes,
            inList
              ? 'bg-accent text-white hover:bg-accent-soft'
              : 'border border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10',
            showStatusMenu && inList ? 'rounded-l-lg rounded-r-none' : 'rounded-lg',
          ].join(' ')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            {inList ? <path d="M5 13l4 4L19 7" /> : <path d="M12 5v14M5 12h14" />}
          </svg>
          {inList ? current?.label ?? 'In watchlist' : 'Add to watchlist'}
        </button>

        {showStatusMenu && inList && (
          <button
            type="button"
            aria-label="Change status"
            onClick={() => setMenuOpen((v) => !v)}
            className={`${sizes} rounded-l-none rounded-r-lg border-l border-white/20 bg-accent px-2.5 text-white hover:bg-accent-soft`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-lg border border-white/10 bg-base-850 shadow-2xl">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setStatus(media.id, s.value)
                  setMenuOpen(false)
                }}
                className={[
                  'block w-full px-3 py-2 text-left text-[13px] transition',
                  entry?.status === s.value
                    ? 'bg-white/10 text-accent-soft'
                    : 'text-zinc-200 hover:bg-white/5',
                ].join(' ')}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
