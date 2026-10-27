'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { IconArrowRight, IconCheck, IconClock, IconPlay, IconTrash } from '@/components/icons'
import { useDismissed, useEpisodeProgress } from '@/lib/collections'
import { formatTime, progressPercent, useProgress, useWatchlist } from '@/lib/store'

/**
 * Up next.
 *
 * One queue across every title the viewer has started: the episode in progress
 * first, then the next episode of each other title, most recent activity first.
 * This answers "what do I watch now" without visiting each detail page in turn.
 */
export default function UpNextPage() {
  const { all, remove } = useProgress()
  const { entries: watchlist, setStatus, setWatchedEpisodes } = useWatchlist()
  const { isWatched, countFor, markWatched } = useEpisodeProgress()
  const { has: isDismissed, dismiss } = useDismissed('upnext')

  const queue = useMemo(() => {
    return (
      Object.values(all)
        .map((p) => {
          // progressPercent is 0-100, not a fraction.
          const pct = progressPercent(p)
          // Past 90% the viewer has effectively finished — the same threshold
          // the stats page uses for "completed", so the two agree. The
          // interesting entry is then the next episode, not a resume point
          // seconds from the end.
          const finished = pct >= 90
          const nextEp = finished ? p.episode + 1 : p.episode
          return { entry: p, pct, finished, nextEp, position: finished ? 0 : p.position }
        })
        .filter((r) => !isDismissed(r.entry.animeId))
        // A title with no next episode and nothing left to resume is done with.
        .filter((r) => {
          const total = r.entry.totalEpisodes
          return r.nextEp <= (total ?? Number.POSITIVE_INFINITY)
        })
        .sort((a, b) => {
          // Resumable first: a half-watched episode outranks one never started.
          if (a.finished !== b.finished) return a.finished ? 1 : -1
          return b.entry.updatedAt - a.entry.updatedAt
        })
    )
  }, [all, isDismissed])

  const tickedTotal = queue.reduce((n, r) => n + countFor(r.entry.animeId), 0)

  return (
    <div className="container-page py-6">
      <header className="mb-6">
        <p className="eyebrow mb-1">Your queue</p>
        <h1 className="font-display text-2xl font-semibold text-zinc-100">Up next</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">
          Everything you have started, in one list. Resume where you left off, or pick up the next
          episode.
        </p>
      </header>

      {queue.length === 0 ? (
        <div className="card p-10 text-center">
          <IconPlay size={26} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-300">Nothing in the queue yet.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-zinc-500">
            Start any episode and it appears here, along with the next one to watch.
          </p>
          <Link href="/trending" className="btn-primary mt-5 inline-flex items-center gap-1.5 text-sm">
            Browse trending
            <IconArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-[0.65rem] uppercase tracking-wider text-zinc-500">
            <span>{queue.length} in progress</span>
            <span className="text-zinc-700">·</span>
            <span>{tickedTotal} episodes ticked</span>
          </div>

          <ul className="grid gap-3">
            {queue.map(({ entry, pct, finished, nextEp, position }) => {
              const inList = watchlist.find((w) => w.id === entry.animeId)
              const total = entry.totalEpisodes
              const ticked = countFor(entry.animeId)
              const nextMarked = isWatched(entry.animeId, nextEp)
              const done = total != null && nextEp > total

              return (
                <li
                  key={`${entry.animeId}-${entry.type}`}
                  className="card group relative flex gap-3.5 overflow-hidden p-3 animate-fade-up sm:gap-4"
                >
                  <Link
                    href={`/anime/${entry.animeId}`}
                    className="relative h-[6.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-md bg-base-700 sm:h-[7.5rem] sm:w-[5.2rem]"
                  >
                    {entry.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                            src={entry.poster}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          // An empty src makes the browser re-request the page
                          // itself, so render a placeholder instead.
                          <span className="grid h-full w-full place-items-center bg-base-750 text-[0.6rem] text-zinc-600">
                            No art
                          </span>
                        )}
                    {!finished && pct > 0 && (
                      <span className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                        <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/anime/${entry.animeId}`}
                      className="truncate text-sm font-medium text-zinc-100 transition-colors hover:text-accent-soft"
                    >
                      {entry.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-zinc-500">
                      {finished ? 'Finished' : 'Resume'} EP {entry.episode}
                      {total != null ? ` / ${total}` : ''} · {entry.type.toUpperCase()}
                      {ticked > 0 ? ` · ${ticked} ticked` : ''}
                    </p>

                    {!finished && entry.duration > 0 && (
                      <p className="mt-1 flex items-center gap-1.5 font-mono text-[0.68rem] text-zinc-500">
                        <IconClock size={11} />
                        {formatTime(position)} of {formatTime(entry.duration)} ·{' '}
                        {formatTime(Math.max(0, entry.duration - position))} left
                      </p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2.5">
                      {!done ? (
                        <Link
                          href={`/watch/${entry.animeId}/${nextEp}${entry.type === 'dub' ? '?type=dub' : ''}`}
                          className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                        >
                          <IconPlay size={13} />
                          {finished ? `Play EP ${nextEp}` : `Resume EP ${entry.episode}`}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
                          <IconCheck size={13} />
                          Caught up
                        </span>
                      )}

                      {!done && !nextMarked && (
                        <button
                          type="button"
                          onClick={() => {
                            markWatched(entry.animeId, nextEp)
                            setWatchedEpisodes(entry.animeId, ticked + 1)
                          }}
                          className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
                        >
                          <IconCheck size={13} />
                          Ticked
                        </button>
                      )}

                      {inList && inList.status !== 'watching' && (
                        <button
                          type="button"
                          onClick={() => setStatus(entry.animeId, 'watching')}
                          className="btn-ghost px-2.5 py-1.5 text-xs"
                        >
                          Mark watching
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      // Dismissal hides it from the queue without touching
                      // progress; the progress removal is what actually clears
                      // the row, and it drops both audio tracks at once.
                      dismiss(entry.animeId)
                      remove(entry.animeId)
                    }}
                    aria-label={`Remove ${entry.title} from the queue`}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded text-zinc-600 opacity-0 transition-all hover:bg-white/[0.06] hover:text-zinc-200 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <IconTrash size={14} />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
