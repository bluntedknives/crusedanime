'use client'

import { useEffect, useState } from 'react'
import { clearRecent, readRecent } from './SearchBar'
import { IconClose, IconHistory } from './icons'

/**
 * Recent searches, shown on the empty search page.
 *
 * The top-bar field keeps this list; without it here the only way to reuse a
 * previous query was to retype it into the field that already knew it.
 */
export default function RecentSearches({ onPick }: { onPick: (q: string) => void }) {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => setRecent(readRecent()), [])

  if (!recent.length) return null

  return (
    <section className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <IconHistory size={14} className="text-zinc-500" />
          Recent searches
        </h2>
        <button
          type="button"
          onClick={() => {
            clearRecent()
            setRecent([])
          }}
          className="text-[11px] text-zinc-500 transition hover:text-zinc-300"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {recent.map((r) => (
          <span
            key={r}
            className="group inline-flex items-center gap-1 rounded-md border border-white/[0.08] py-1 pl-2.5 pr-1.5 text-xs text-zinc-300 transition hover:border-accent/40 hover:bg-accent/10"
          >
            <button type="button" onClick={() => onPick(r)} className="hover:text-accent-soft">
              {r}
            </button>
            <button
              type="button"
              aria-label={`Forget ${r}`}
              onClick={() => {
                const next = readRecent().filter((x) => x !== r)
                try {
                  window.localStorage.setItem('anistream:recent-searches:v1', JSON.stringify(next))
                } catch {
                  /* ignore */
                }
                setRecent(next)
              }}
              className="grid h-4 w-4 place-items-center rounded text-zinc-600 hover:text-zinc-300"
            >
              <IconClose size={11} />
            </button>
          </span>
        ))}
      </div>
    </section>
  )
}
