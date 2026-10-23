import type { Metadata } from 'next'
import Link from 'next/link'
import * as data from '@/lib/data'
import type { MediaSeason } from '@/lib/anilist'
import PosterCard from '@/components/PosterCard'
import { IconCalendar } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Seasons',
  description: 'Browse anime by season and year.',
}

export const revalidate = 3600

const SEASONS: { value: MediaSeason; label: string; months: string }[] = [
  { value: 'WINTER', label: 'Winter', months: 'Jan–Mar' },
  { value: 'SPRING', label: 'Spring', months: 'Apr–Jun' },
  { value: 'SUMMER', label: 'Summer', months: 'Jul–Sep' },
  { value: 'FALL', label: 'Fall', months: 'Oct–Dec' },
]

/** The season currently airing, derived from the date rather than hardcoded. */
function currentSeason(now = new Date()): { season: MediaSeason; year: number } {
  const m = now.getMonth()
  const season: MediaSeason = m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL'
  return { season, year: now.getFullYear() }
}

function parse(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 1940 && n < 2100 ? n : fallback
}

export default async function SeasonPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; year?: string }>
}) {
  const sp = await searchParams
  const now = currentSeason()
  const year = parse(sp.year, now.year)
  const season = (SEASONS.find((s) => s.value === sp.season)?.value ?? now.season) as MediaSeason

  const { data: page } = await data.search({
    season,
    year,
    sort: ['POPULARITY_DESC'],
    perPage: 40,
    // The catalogue is anime-only, and adult titles should not appear in a
    // general browse surface.
    isAdult: false,
  })

  const label = SEASONS.find((s) => s.value === season)!
  const isCurrent = season === now.season && year === now.year
  const years = Array.from({ length: 9 }, (_, i) => now.year + 1 - i)

  const href = (s: MediaSeason, y: number) => `/season?season=${s}&year=${y}`

  return (
    <div className="container-page py-8">
      <header className="mb-6">
        <p className="eyebrow">Browse</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-zinc-100">
          <IconCalendar size={22} className="text-accent" />
          {label.label} {year}
          {isCurrent && (
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-soft">
              Airing now
            </span>
          )}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {label.months} {year} · {page.pageInfo.total} title{page.pageInfo.total === 1 ? '' : 's'}
        </p>
      </header>

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {SEASONS.map((s) => (
            <Link
              key={s.value}
              href={href(s.value, year)}
              className={['chip transition', s.value === season ? 'chip-active' : 'hover:bg-white/10'].join(' ')}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <Link
              key={y}
              href={href(season, y)}
              className={['chip transition', y === year ? 'chip-active' : 'hover:bg-white/10'].join(' ')}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {page.media.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-sm font-semibold text-zinc-200">Nothing listed for this season</p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
            Try another season or year. Upcoming seasons stay empty until the catalogue lists them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {page.media.map((m) => (
            <PosterCard key={m.id} media={m} />
          ))}
        </div>
      )}
    </div>
  )
}
