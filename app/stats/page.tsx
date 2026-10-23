'use client'

import Link from 'next/link'
import {
  IconChart,
  IconClock,
  IconFilm,
  IconFlame2,
  IconGrid2,
  IconStar,
  IconTrophy,
} from '@/components/icons'
import {
  formatDuration,
  useLibraryStats,
  useRatings,
  useWatchlist,
} from '@/lib/store'

/**
 * Viewing statistics.
 *
 * Everything here is derived from locally stored progress and history, so the
 * page works with no account and no network. It is a client component because
 * that data lives in localStorage.
 */
export default function StatsPage() {
  const stats = useLibraryStats()
  const { entries: watchlist } = useWatchlist()
  const { count: ratedCount, average } = useRatings()

  const hasData = stats.episodesStarted > 0 || watchlist.length > 0

  const byStatus = watchlist.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {})

  const cards = [
    {
      label: 'Watch time',
      value: formatDuration(stats.watchSeconds),
      // History can be empty while progress still holds watch time, so the
      // hint keys off the value it is describing rather than the history list.
      hint:
        stats.watchSeconds <= 0
          ? 'no data yet'
          : stats.firstWatchedAt
            ? `since ${new Date(stats.firstWatchedAt).toLocaleDateString()}`
            : `across ${stats.titlesStarted} title${stats.titlesStarted === 1 ? '' : 's'}`,
      icon: <IconClock size={18} />,
    },
    {
      label: 'Episodes watched',
      value: String(stats.episodesCompleted),
      hint: `${stats.episodesStarted} started`,
      icon: <IconFilm size={18} />,
    },
    {
      label: 'Titles',
      value: String(stats.titlesStarted),
      hint: `${stats.titlesCompleted} completed`,
      icon: <IconGrid2 size={18} />,
    },
    {
      label: 'Current streak',
      value: stats.streak === 1 ? '1 day' : `${stats.streak} days`,
      hint: `longest ${stats.longestStreak}`,
      icon: <IconFlame2 size={18} />,
    },
  ]

  return (
    <div className="container-page py-8">
      <header className="mb-8">
        <p className="eyebrow">Your library</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-zinc-100">
          <IconChart size={22} className="text-accent" />
          Statistics
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Computed from what this browser has stored. Nothing leaves your device.
        </p>
      </header>

      {!hasData ? (
        <div className="card p-10 text-center">
          <IconChart size={28} className="mx-auto text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-200">Nothing to measure yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Watch an episode and this page fills in: watch time, completion rate, streaks and a
            genre breakdown.
          </p>
          <Link href="/search" className="btn-primary mt-5">
            Find something to watch
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="card p-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="text-accent">{c.icon}</span>
                  <span className="text-xs font-medium uppercase tracking-wide">{c.label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{c.value}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{c.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* --------------------------------------------------- completion */}
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-zinc-100">Completion</h2>
              <div className="mt-4 flex items-center gap-4">
                <div
                  className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(var(--accent, #7c5cff) ${
                      stats.completionRate * 360
                    }deg, rgba(255,255,255,0.08) 0deg)`,
                  }}
                >
                  <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-base-900">
                    <span className="text-lg font-semibold tabular-nums text-zinc-100">
                      {Math.round(stats.completionRate * 100)}%
                    </span>
                  </div>
                </div>
                <div className="min-w-0 text-sm">
                  <p className="text-zinc-300">
                    <span className="font-semibold text-zinc-100">{stats.episodesCompleted}</span>{' '}
                    of {stats.episodesStarted} episodes finished
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    An episode counts as finished at 90% — the last minutes are usually credits.
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Active on {stats.activeDays} of the last 30 days
                  </p>
                </div>
              </div>

              {watchlist.length > 0 && (
                <div className="mt-5 border-t border-white/[0.06] pt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Watchlist by status
                  </h3>
                  <div className="mt-3 space-y-2">
                    {(['watching', 'planned', 'completed', 'paused', 'dropped'] as const)
                      .filter((s) => byStatus[s])
                      .map((s) => {
                        const n = byStatus[s]
                        const pct = (n / watchlist.length) * 100
                        return (
                          <div key={s} className="flex items-center gap-3 text-xs">
                            <span className="w-20 shrink-0 capitalize text-zinc-400">{s}</span>
                            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                              <div
                                className="h-full rounded-full bg-accent"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-6 shrink-0 text-right tabular-nums text-zinc-300">
                              {n}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </section>

            {/* ------------------------------------------------------ genres */}
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-zinc-100">Genres by watch time</h2>
              {stats.genreSlices.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">
                  No genre data yet. Genres are recorded as you watch, so this fills in from your
                  next episode.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {stats.genreSlices.slice(0, 8).map((g) => (
                    <li key={g.genre}>
                      <div className="flex items-baseline justify-between text-xs">
                        <Link
                          href={`/search?genre=${encodeURIComponent(g.genre)}`}
                          className="text-zinc-200 hover:text-accent-soft"
                        >
                          {g.genre}
                        </Link>
                        <span className="tabular-nums text-zinc-500">
                          {formatDuration(g.minutes * 60)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className="h-full rounded-full bg-accent-soft"
                          style={{ width: `${Math.max(2, g.share * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {(ratedCount > 0 || stats.topTitle) && (
                <div className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
                  {stats.topTitle && (
                    <div className="flex items-start gap-2">
                      <IconTrophy size={16} className="mt-0.5 shrink-0 text-accent" />
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500">Most watched</p>
                        <p className="truncate text-sm text-zinc-200">{stats.topTitle.title}</p>
                        <p className="text-xs text-zinc-500">
                          {stats.topTitle.episodes} episode
                          {stats.topTitle.episodes === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                  )}
                  {ratedCount > 0 && average != null && (
                    <div className="flex items-start gap-2">
                      <IconStar size={16} className="mt-0.5 shrink-0 text-signal" />
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500">Your average score</p>
                        <p className="text-sm text-zinc-200">{average.toFixed(1)} / 10</p>
                        <p className="text-xs text-zinc-500">across {ratedCount} titles</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
