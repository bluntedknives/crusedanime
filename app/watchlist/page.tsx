'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useProgress, useViewMode, useWatchlist, type WatchStatus } from '@/lib/store'
import { formatTime, progressPercent } from '@/lib/store'

const STATUS_LABELS: Record<WatchStatus, string> = {
  watching: 'Watching',
  planned: 'Plan to watch',
  completed: 'Completed',
  paused: 'On hold',
  dropped: 'Dropped',
}

const ORDER: WatchStatus[] = ['watching', 'planned', 'completed', 'paused', 'dropped']

function EntryCard({
  entry,
  view,
  onRemove,
  onStatus,
  progress,
}: {
  entry: ReturnType<typeof useWatchlist>['entries'][number]
  view: 'grid' | 'list'
  onRemove: () => void
  onStatus: (s: WatchStatus) => void
  progress?: { episode: number; position: number; duration: number } | null
}) {
  const pct = progress ? progressPercent(progress) : 0

  if (view === 'list') {
    return (
      <div className="surface flex items-center gap-3 p-2.5">
        <Link
          href={`/anime/${entry.id}`}
          className="h-[76px] w-[54px] shrink-0 overflow-hidden rounded bg-ink-700"
        >
          {entry.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : null}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/anime/${entry.id}`}
            className="line-clamp-1 text-[13.5px] font-medium text-zinc-100 hover:text-brand-soft"
          >
            {entry.title}
          </Link>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {[entry.format, entry.year, entry.episodes ? `${entry.episodes} ep` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {progress && (
            <p className="mt-1 text-[11px] text-brand-soft">
              EP {progress.episode} · {formatTime(progress.position)}
            </p>
          )}
          {pct > 0 && (
            <div className="mt-1.5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <select
            value={entry.status}
            onChange={(e) => onStatus(e.target.value as WatchStatus)}
            className="rounded-md border border-white/10 bg-ink-800 px-2 py-1.5 text-[11px] text-zinc-200"
          >
            {ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <Link
            href={`/watch/${entry.id}/${progress?.episode ?? 1}`}
            className="btn-ghost px-3 py-1.5 text-[11px]"
          >
            {progress ? 'Resume' : 'Watch'}
          </Link>
          <button
            type="button"
            onClick={onRemove}
            className="btn-subtle px-2 py-1.5 text-[11px] text-red-300 hover:bg-red-500/10"
            aria-label={`Remove ${entry.title}`}
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group">
      <Link href={`/anime/${entry.id}`} className="relative block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-ink-800 poster-shadow">
          {entry.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.poster}
              alt={entry.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center p-3 text-center text-xs text-zinc-500">
              {entry.title}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {pct > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
              <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          )}
          {progress && (
            <span className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-brand-soft">
              EP {progress.episode}
            </span>
          )}
        </div>
      </Link>

      <div className="mt-2">
        <Link
          href={`/anime/${entry.id}`}
          className="line-clamp-2 text-[13px] font-medium leading-snug text-zinc-100 hover:text-brand-soft"
        >
          {entry.title}
        </Link>
        <div className="mt-1.5 flex items-center gap-1.5">
          <select
            value={entry.status}
            onChange={(e) => onStatus(e.target.value as WatchStatus)}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-ink-800 px-1.5 py-1 text-[10.5px] text-zinc-300"
          >
            {ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <Link
            href={`/watch/${entry.id}/${progress?.episode ?? 1}`}
            className="shrink-0 rounded-md bg-brand/90 px-2 py-1 text-[10.5px] font-semibold text-white hover:bg-brand"
          >
            ▶
          </Link>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10.5px] text-red-300 hover:bg-red-500/10"
            aria-label={`Remove ${entry.title}`}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WatchlistPage() {
  const { entries, ready, remove, setStatus, clear, byStatus } = useWatchlist()
  const { mode, setMode } = useViewMode()
  const { all, continueWatching, clear: clearProgress } = useProgress()
  const [tab, setTab] = useState<'all' | WatchStatus>('all')
  const [query, setQuery] = useState('')

  const progressFor = useMemo(() => {
    const map: Record<number, { episode: number; position: number; duration: number }> = {}
    for (const p of Object.values(all)) {
      const prev = map[p.animeId]
      if (!prev || p.updatedAt > prev.episode) {
        map[p.animeId] = { episode: p.episode, position: p.position, duration: p.duration }
      }
    }
    return map
  }, [all])

  const filtered = useMemo(() => {
    let list = tab === 'all' ? entries : byStatus[tab]
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((e) => e.title.toLowerCase().includes(q))
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [entries, byStatus, tab, query])

  const counts = useMemo(
    () => ({
      all: entries.length,
      ...ORDER.reduce(
        (acc, s) => ({ ...acc, [s]: byStatus[s].length }),
        {} as Record<WatchStatus, number>,
      ),
    }),
    [entries.length, byStatus],
  )

  return (
    <div className="container-page animate-fade-in pt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">My watchlist</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Stored locally in your browser · {entries.length} title{entries.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            {(['grid', 'list'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={[
                  'px-3 py-2 text-[12px] font-medium capitalize transition',
                  mode === m ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5',
                ].join(' ')}
              >
                {m}
              </button>
            ))}
          </div>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove every title from your watchlist and clear progress?')) {
                  clear()
                  clearProgress()
                }
              }}
              className="btn-ghost text-xs text-red-300 hover:bg-red-500/10"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* continue watching */}
      {continueWatching.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-3">Continue watching</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
            {continueWatching.map((p) => (
              <Link
                key={`${p.animeId}-${p.type}`}
                href={`/watch/${p.animeId}/${p.episode}${p.type === 'dub' ? '?type=dub' : ''}`}
                className="group w-[220px] shrink-0 snap-start"
              >
                <div className="relative h-[124px] overflow-hidden rounded-lg bg-ink-800">
                  {p.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.poster}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="line-clamp-1 text-[12px] font-medium text-white">{p.title}</p>
                    <p className="text-[10.5px] text-zinc-400">
                      EP {p.episode}
                      {p.totalEpisodes ? ` / ${p.totalEpisodes}` : ''} ·{' '}
                      {formatTime(p.position)}
                      {p.type === 'dub' ? ' · DUB' : ''}
                    </p>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                    <div className="h-full bg-brand" style={{ width: `${progressPercent(p)}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* tabs + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(['all', ...ORDER] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={['chip transition', tab === t ? 'chip-active' : 'hover:bg-white/10'].join(' ')}
            >
              {t === 'all' ? 'All' : STATUS_LABELS[t]}
              <span className="text-zinc-500">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter your list…"
          className="input ml-auto w-full py-2 text-[13px] sm:w-64"
        />
      </div>

      {!ready ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton aspect-[2/3] w-full" />
              <div className="skeleton mt-2 h-3 w-4/5" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-sm font-semibold text-zinc-200">
            {entries.length ? 'Nothing matches this filter' : 'Your watchlist is empty'}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
            {entries.length
              ? 'Try another status tab or clear the filter box.'
              : 'Add titles from any poster, the detail page, or the player. Everything is saved in this browser.'}
          </p>
          <Link href="/search" className="btn-primary mt-4">
            Browse anime
          </Link>
        </div>
      ) : mode === 'grid' ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              view="grid"
              progress={progressFor[e.id]}
              onRemove={() => remove(e.id)}
              onStatus={(s) => setStatus(e.id, s)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              view="list"
              progress={progressFor[e.id]}
              onRemove={() => remove(e.id)}
              onStatus={(s) => setStatus(e.id, s)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
