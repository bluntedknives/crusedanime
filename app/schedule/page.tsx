import Link from 'next/link'
import AiringCountdown from '@/components/AiringCountdown'
import { airingSchedule, posterOf, titleOf, type AiringScheduleEntry } from '@/lib/anilist'

export const revalidate = 600

const DAY_MS = 86_400_000

function startOfWeekUTC(): Date {
  // AniList schedules are published in UTC; anchor the week to the current
  // UTC day so the grouping never shifts by locale.
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return d
}

function dayKey(unix: number): string {
  const d = new Date(unix * 1000)
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

function formatDay(unix: number): { weekday: string; date: string; isToday: boolean } {
  const d = new Date(unix * 1000)
  const today = new Date()
  const isToday =
    d.getUTCDate() === today.getUTCDate() &&
    d.getUTCMonth() === today.getUTCMonth() &&
    d.getUTCFullYear() === today.getUTCFullYear()
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    isToday,
  }
}

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
}

function EntryRow({ entry }: { entry: AiringScheduleEntry }) {
  const m = entry.media
  const poster = posterOf(m)
  return (
    <Link
      href={`/anime/${m.id}`}
      className="group flex items-center gap-3 rounded-lg border border-white/5 bg-ink-850/60 p-2.5 transition hover:border-white/15 hover:bg-ink-800"
    >
      <span className="w-12 shrink-0 text-center">
        <span className="block text-[13px] font-semibold tabular-nums text-zinc-200">
          {formatTime(entry.airingAt)}
        </span>
        <span className="block text-[10px] uppercase tracking-wide text-zinc-500">UTC</span>
      </span>

      <span className="h-14 w-10 shrink-0 overflow-hidden rounded bg-ink-700">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-[13px] font-medium text-zinc-100 group-hover:text-brand-soft">
          {titleOf(m)}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-zinc-500">
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-semibold text-zinc-300">
            EP {entry.episode}
          </span>
          {m.format && <span>{m.format.replace(/_/g, ' ')}</span>}
          {m.episodes ? <span>· {m.episodes} total</span> : null}
        </span>
      </span>

      <span className="shrink-0">
        <AiringCountdown airingAt={entry.airingAt} compact />
      </span>
    </Link>
  )
}

export default async function SchedulePage() {
  const weekStart = startOfWeekUTC()
  const from = Math.floor(weekStart.getTime() / 1000)
  const to = from + 7 * (DAY_MS / 1000)

  let entries: AiringScheduleEntry[] = []
  let error: string | null = null

  try {
    // The API caps perPage at 50; page through to cover a busy week.
    const pages = await Promise.all([
      airingSchedule(from, to, 1, 50),
      airingSchedule(from, to, 2, 50),
      airingSchedule(from, to, 3, 50),
    ])
    entries = pages.flatMap((p) => p.airingSchedules ?? [])
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not load the schedule'
  }

  // De-duplicate (a title can appear once per episode) and sort by time.
  const seen = new Set<number>()
  const unique = entries
    .filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
    .sort((a, b) => a.airingAt - b.airingAt)

  const grouped = new Map<string, AiringScheduleEntry[]>()
  for (let i = 0; i < 7; i++) {
    const dayUnix = from + i * (DAY_MS / 1000)
    grouped.set(dayKey(dayUnix), [])
  }
  for (const e of unique) {
    const key = dayKey(e.airingAt)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(e)
  }

  const days: [string, AiringScheduleEntry[]][] = Array.from(grouped.entries())

  return (
    <div className="container-page animate-fade-in pt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            Airing this week
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {weekStart.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
            })}{' '}
            · 7 days · times shown in UTC
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn-ghost text-xs">
            Home
          </Link>
          <Link href="/search?status=RELEASING&sort=POPULARITY_DESC" className="btn-ghost text-xs">
            Currently airing
          </Link>
        </div>
      </div>

      {error && (
        <div className="surface mb-6 border-amber-500/20 p-4 text-sm text-amber-200">{error}</div>
      )}

      <div className="space-y-6">
        {days.map(([key, list]: [string, AiringScheduleEntry[]]) => {
          const dayUnix = Math.floor(new Date(`${key.split('-').slice(0, 2).join('-')}-${key.split('-')[2]}T00:00:00Z`).getTime() / 1000)
          const unix = list[0]?.airingAt ?? dayUnix
          const { weekday, date, isToday } = formatDay(unix)

          return (
            <section key={key}>
              <div className="mb-2.5 flex items-center gap-3">
                <h2
                  className={[
                    'text-base font-semibold tracking-tight',
                    isToday ? 'text-brand-soft' : 'text-zinc-100',
                  ].join(' ')}
                >
                  {weekday}
                </h2>
                <span className="text-xs text-zinc-500">{date}</span>
                {isToday && (
                  <span className="chip border-brand/40 bg-brand/15 text-brand-soft">Today</span>
                )}
                <span className="ml-auto text-[11px] text-zinc-500">
                  {list.length} episode{list.length === 1 ? '' : 's'}
                </span>
              </div>

              {list.length ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  {list.map((e) => (
                    <EntryRow key={e.id} entry={e} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-white/5 px-4 py-5 text-center text-xs text-zinc-600">
                  Nothing scheduled.
                </p>
              )}
            </section>
          )
        })}
      </div>

      {!unique.length && !error && (
        <div className="surface p-10 text-center">
          <p className="text-sm font-semibold text-zinc-200">No airings found this week</p>
          <p className="mt-1 text-xs text-zinc-500">
            AniList returned an empty schedule window. Try reloading in a moment.
          </p>
        </div>
      )}
    </div>
  )
}
