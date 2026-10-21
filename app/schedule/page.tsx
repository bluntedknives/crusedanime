import Link from 'next/link'
import AiringCountdown from '@/components/AiringCountdown'
import * as data from '@/lib/data'
import { posterOf, titleOf, type AiringScheduleEntry } from '@/lib/anilist'
import PreviewBanner from '@/components/PreviewBanner'
import { IconClock } from '@/components/icons'

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
      className="group flex items-center gap-3 rounded-lg border border-white/5 bg-base-850/60 p-2.5 transition hover:border-white/15 hover:bg-base-800"
    >
      {/* Kitsu publishes a date but no clock time, so showing an hour would be
          inventing one. Off-schedule rows show the weekday and day-number. */}
      <span className="w-12 shrink-0 text-center">
        {entry.timeKnown === false ? (
          <>
            <span className="block text-[12px] font-semibold uppercase text-zinc-300">
              {new Date(entry.airingAt * 1000).toLocaleDateString('en-US', {
                weekday: 'short',
                timeZone: 'UTC',
              })}
            </span>
            <span className="block text-[13px] font-semibold tabular-nums text-zinc-400">
              {new Date(entry.airingAt * 1000).getUTCDate()}
            </span>
          </>
        ) : (
          <>
            <span className="block text-[13px] font-semibold tabular-nums text-zinc-200">
              {formatTime(entry.airingAt)}
            </span>
            <span className="block text-[10px] uppercase tracking-wide text-zinc-500">UTC</span>
          </>
        )}
      </span>

      <span className="h-14 w-10 shrink-0 overflow-hidden rounded bg-base-700">
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
        <span className="line-clamp-1 block text-[13px] font-medium text-zinc-100 group-hover:text-accent-soft">
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
        {entry.timeKnown === false ? (
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">Scheduled</span>
        ) : (
          <AiringCountdown airingAt={entry.airingAt} compact />
        )}
      </span>
    </Link>
  )
}

export default async function SchedulePage() {
  const weekStart = startOfWeekUTC()
  const from = Math.floor(weekStart.getTime() / 1000)
  const to = from + 7 * (DAY_MS / 1000)

  // AniList publishes real airing times when it is up. When it is not, the real
  // upcoming episodes Kitsu does publish are used. Both are genuinely dated.
  const result = await data.schedule(from, to)
  const entries: AiringScheduleEntry[] = result.data
  const preview = result.preview
  const approximate = result.approximate
  const error: string | null = null

  // De-duplicate (a title can appear once per episode) and sort by time.
  const seen = new Set<number>()
  const unique = entries
    .filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
    .sort((a, b) => a.airingAt - b.airingAt)

  // Real scheduled episodes go in the week grid. Only slots that a provider did
  // not date at all are `derived`, and those are listed separately rather than
  // scattered into days we invented.
  const dated = unique.filter((e) => e.derived !== true)
  const seasonal = unique.filter((e) => e.derived === true)
  const hasDated = dated.length > 0
  // Only claim UTC clock times if a provider actually published any.
  const anyTimes = unique.some((e) => e.timeKnown !== false)

  const grouped = new Map<string, AiringScheduleEntry[]>()
  for (let i = 0; i < 7; i++) {
    const dayUnix = from + i * (DAY_MS / 1000)
    grouped.set(dayKey(dayUnix), [])
  }
  for (const e of dated) {
    const key = dayKey(e.airingAt)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(e)
  }

  const days: [string, AiringScheduleEntry[]][] = Array.from(grouped.entries())

  return (
    <div className="container-page animate-fade-in pt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Schedule</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            Airing this week
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {weekStart.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
            })}{' '}
            · next 7 days{anyTimes ? ' · times in UTC' : ''}
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

      {preview && (
        <div className="mb-5">
          <PreviewBanner compact />
        </div>
      )}

      {approximate && !preview && (
        <div className="mb-5 flex items-center gap-2.5 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
          <IconClock size={16} className="shrink-0 text-zinc-500" />
          <p>
            Airing times are approximate — AniList&rsquo;s schedule is unavailable, so this
            week is derived from currently-airing titles.
          </p>
        </div>
      )}

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
                    isToday ? 'text-accent-soft' : 'text-zinc-100',
                  ].join(' ')}
                >
                  {weekday}
                </h2>
                <span className="text-xs text-zinc-500">{date}</span>
                {isToday && (
                  <span className="chip border-accent/40 bg-accent/15 text-accent-soft">Today</span>
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

      {!hasDated && seasonal.length > 0 && (
        <div className="surface mb-6 p-5 text-center">
          <p className="text-sm font-semibold text-zinc-200">
            No episode has a published air date this week
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Providers publish exact weekly dates a few days ahead. What is currently airing
            is listed below.
          </p>
        </div>
      )}

      {seasonal.length > 0 && (
        <section className="mt-4">
          <div className="mb-2.5 flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight text-zinc-100">
              Currently airing
            </h2>
            <span className="text-xs text-zinc-500">no published air date this week</span>
            <span className="ml-auto text-[11px] text-zinc-500">{seasonal.length} titles</span>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {seasonal.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </div>
        </section>
      )}

      {!unique.length && !error && (
        <div className="surface p-10 text-center">
          <p className="text-sm font-semibold text-zinc-200">No airings found this week</p>
          <p className="mt-1 text-xs text-zinc-500">
            No schedule source returned data for this window. Try reloading in a moment.
          </p>
        </div>
      )}
    </div>
  )
}
