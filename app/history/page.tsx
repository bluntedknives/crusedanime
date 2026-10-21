'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  IconCalendar,
  IconClock,
  IconClose,
  IconFilm,
  IconHistory,
  IconTrash,
} from '../../components/icons'
import { useHistory, relativeTime } from '@/lib/store'

type Range = 'all' | 'today' | 'week'

const DAY_MS = 86_400_000

export default function HistoryPage() {
  const { entries, stats, clear, remove } = useHistory()
  const [range, setRange] = useState<Range>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const now = Date.now()
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    const q = query.trim().toLowerCase()

    return entries.filter((e) => {
      if (range === 'today' && e.watchedAt < startOfToday) return false
      if (range === 'week' && e.watchedAt < now - 7 * DAY_MS) return false
      if (q && !e.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, range, query])

  // Group by calendar day so the list reads as a timeline.
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const e of filtered) {
      const d = new Date(e.watchedAt)
      const key = new Date(d.setHours(0, 0, 0, 0)).getTime().toString()
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort((a, b) => Number(b[0]) - Number(a[0]))
  }, [filtered])

  const dayLabel = (key: string): string => {
    const ts = Number(key)
    const today = new Date().setHours(0, 0, 0, 0)
    if (ts === today) return 'Today'
    if (ts === today - DAY_MS) return 'Yesterday'
    return new Date(ts).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="container-page animate-fade-in pt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            Watch history
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Every episode you have opened, newest first. Stored in this browser.
          </p>
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Clear your entire watch history?')) clear()
            }}
            className="btn-ghost h-9 text-xs text-red-300 hover:bg-red-500/10"
          >
            <IconTrash size={14} />
            Clear history
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: 'Today', value: stats.today, Icon: IconClock },
          { label: 'This week', value: stats.week, Icon: IconCalendar },
          { label: 'Episodes', value: stats.total, Icon: IconFilm },
          { label: 'Titles', value: stats.titles, Icon: IconHistory },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="surface p-3.5">
            <div className="flex items-center gap-2 text-zinc-500">
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em]">{label}</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-50">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { v: 'all' as const, label: 'All time' },
              { v: 'week' as const, label: 'Last 7 days' },
              { v: 'today' as const, label: 'Today' },
            ]
          ).map(({ v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => setRange(v)}
              className={['chip transition', range === v ? 'chip-active' : 'hover:bg-white/10'].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter history…"
          className="input ml-auto w-full py-2 text-[13px] sm:w-64"
        />
      </div>

      {entries.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-sm font-semibold text-zinc-200">Nothing watched yet</p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
            Episodes appear here as soon as you open them. Your progress is saved automatically.
          </p>
          <Link href="/search" className="btn-primary mt-4">
            Find something to watch
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface p-10 text-center text-sm text-zinc-400">
          No history in this range.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, list]) => (
            <section key={key}>
              <h2 className="mb-2.5 flex items-center gap-3 text-sm font-semibold text-zinc-200">
                {dayLabel(key)}
                <span className="font-mono text-[0.6rem] uppercase tracking-wide text-zinc-600">
                  {list.length} episode{list.length === 1 ? '' : 's'}
                </span>
              </h2>

              <div className="space-y-2">
                {list.map((e) => (
                  <div
                    key={`${e.animeId}-${e.episode}-${e.type}-${e.watchedAt}`}
                    className="surface group flex items-center gap-3 p-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
                  >
                    <Link
                      href={`/watch/${e.animeId}/${e.episode}${e.type === 'dub' ? '?type=dub' : ''}`}
                      className="h-[68px] w-[48px] shrink-0 overflow-hidden rounded bg-base-700"
                    >
                      {e.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.poster}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/watch/${e.animeId}/${e.episode}${e.type === 'dub' ? '?type=dub' : ''}`}
                        className="line-clamp-1 text-[13.5px] font-medium text-zinc-100 transition-colors hover:text-accent-soft"
                      >
                        {e.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[0.65rem] text-zinc-500">
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-semibold text-zinc-300">
                          EP {e.episode}
                        </span>
                        {e.type === 'dub' && <span className="uppercase">dub</span>}
                        <span>· {relativeTime(e.watchedAt)}</span>
                      </p>
                    </div>

                    <Link
                      href={`/anime/${e.animeId}`}
                      className="hidden shrink-0 text-xs text-zinc-500 transition-colors hover:text-accent-soft sm:block"
                    >
                      Details
                    </Link>

                    <button
                      type="button"
                      onClick={() => remove(e.animeId, e.episode, e.type)}
                      aria-label={`Remove ${e.title} episode ${e.episode} from history`}
                      className="btn-icon h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <IconClose size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
