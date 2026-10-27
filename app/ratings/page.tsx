'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { IconStar, IconTrash } from '@/components/icons'
import RatingStars from '@/components/RatingStars'
import { useNotes } from '@/lib/collections'
import { useRatings, useWatchlist, type WatchlistEntry } from '@/lib/store'

type Sort = 'score' | 'title' | 'recent'

/**
 * Your ratings.
 *
 * A list of everything the viewer has scored, sortable, with the distribution
 * of their own scores as a histogram. The histogram is the point of the page:
 * it is the one view that shows whether a viewer is generous or harsh, which a
 * single average cannot express.
 */
export default function RatingsPage() {
  const { ratings, set, average, count, clear } = useRatings()
  const { entries: watchlist } = useWatchlist()
  const { get: getNote } = useNotes()
  const [sort, setSort] = useState<Sort>('score')

  const rows = useMemo(() => {
    const list: { entry: WatchlistEntry | null; id: number; score: number }[] = Object.entries(ratings).map(
      ([id, score]) => ({
        id: Number(id),
        score,
        entry: watchlist.find((w) => w.id === Number(id)) ?? null,
      }),
    )
    if (sort === 'score') list.sort((a, b) => b.score - a.score)
    if (sort === 'title') {
      list.sort((a, b) => (a.entry?.title ?? String(a.id)).localeCompare(b.entry?.title ?? String(b.id)))
    }
    if (sort === 'recent') {
      list.sort((a, b) => (b.entry?.updatedAt ?? 0) - (a.entry?.updatedAt ?? 0))
    }
    return list
  }, [ratings, watchlist, sort])

  // Ten buckets, 1–10. Counts are of the viewer's own scores only.
  const buckets = useMemo(() => {
    const out = Array.from({ length: 10 }, () => 0)
    for (const s of Object.values(ratings)) {
      const i = Math.max(1, Math.min(10, Math.round(s))) - 1
      out[i]++
    }
    return out
  }, [ratings])
  const peak = Math.max(1, ...buckets)

  return (
    <div className="container-page py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Personal</p>
          <h1 className="font-display text-2xl font-semibold text-zinc-100">Your ratings</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">
            Scores you have given, out of ten. Separate from AniList&apos;s community average.
          </p>
        </div>
        {count > 0 && (
          <button type="button" onClick={clear} className="btn-ghost inline-flex items-center gap-1.5 text-xs">
            <IconTrash size={13} />
            Clear all
          </button>
        )}
      </header>

      {count === 0 ? (
        <div className="card p-10 text-center">
          <IconStar size={26} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-300">You have not rated anything yet.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-zinc-500">
            Open a title and score it out of ten — the stars are on the detail page.
          </p>
          <Link href="/trending" className="btn-primary mt-5 inline-flex text-sm">
            Find something to rate
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="order-2 lg:order-1">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-mono text-[0.62rem] uppercase tracking-wider text-zinc-500">Sort</span>
              <div className="flex gap-1">
                {(
                  [
                    ['score', 'Score'],
                    ['title', 'Title'],
                    ['recent', 'Recent'],
                  ] as [Sort, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSort(k)}
                    className={[
                      'rounded-md px-2.5 py-1 text-xs transition-colors',
                      sort === k ? 'bg-accent/20 text-accent-soft' : 'text-zinc-400 hover:bg-white/[0.05]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="grid gap-2">
              {rows.map(({ id, score, entry }) => {
                const note = getNote(id)
                return (
                  <li key={id} className="card flex items-center gap-3 p-2.5">
                    <Link
                      href={`/anime/${id}`}
                      className="h-14 w-10 shrink-0 overflow-hidden rounded bg-base-700"
                    >
                      {entry?.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.poster}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        // No poster on record: a placeholder rather than an
                        // empty src, which would re-request the page itself.
                        <span className="grid h-full w-full place-items-center text-[0.6rem] text-zinc-600">
                          —
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/anime/${id}`}
                        className="block truncate text-sm text-zinc-100 transition-colors hover:text-accent-soft"
                      >
                        {entry?.title ?? `Title ${id}`}
                      </Link>
                      <RatingStars value={score} onChange={(v) => set(id, v)} size={16} className="mt-1" />
                      {note && <p className="mt-1 truncate text-[0.7rem] italic text-zinc-500">“{note}”</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => set(id, null)}
                      aria-label={`Remove rating for ${entry?.title ?? id}`}
                      className="shrink-0 text-zinc-600 transition-colors hover:text-red-400"
                    >
                      <IconTrash size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <aside className="order-1 lg:order-2">
            <div className="card p-4">
              <p className="eyebrow mb-3">Distribution</p>
              <div className="flex h-32 items-end gap-1">
                {buckets.map((n, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="font-mono text-[0.58rem] tabular-nums text-zinc-500">
                      {n > 0 ? n : ''}
                    </span>
                    <div
                      className="w-full rounded-t bg-accent/70 transition-[height] duration-300"
                      style={{ height: `${(n / peak) * 100}%`, minHeight: n > 0 ? 3 : 0 }}
                      title={`${n} title(s) rated ${i + 1}`}
                    />
                    <span className="font-mono text-[0.55rem] text-zinc-600">{i + 1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-white/[0.07] pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Titles rated</span>
                  <span className="font-mono tabular-nums text-zinc-200">{count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Average</span>
                  <span className="font-mono tabular-nums text-accent-soft">
                    {average != null ? average.toFixed(1) : '—'} / 10
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Highest</span>
                  <span className="font-mono tabular-nums text-zinc-200">
                    {rows.length ? Math.max(...rows.map((r) => r.score)) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
