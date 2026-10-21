import type { Metadata } from 'next'
import Link from 'next/link'
import * as movies from '@/lib/movies'
import { GENRES } from '@/lib/cinemeta'
import PosterCard from '@/components/PosterCard'
import MediaRail from '@/components/MediaRail'
import { isCovered } from '@/lib/coverServer'
import { coverLabel } from '@/lib/cover'
import type { Media } from '@/lib/anilist'

export const revalidate = 1800

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Movies & TV' }
}

interface Props {
  searchParams: Promise<{ genre?: string; kind?: string }>
}

/**
 * Films and series, in the same grid language as the anime side.
 *
 * Genre browsing is a server render driven by `?genre=`, so a genre view is a
 * real URL that can be linked and shared rather than client state.
 */
export default async function MoviesPage({ searchParams }: Props) {
  const covered = await isCovered()
  const { genre, kind: rawKind } = await searchParams
  const kind: 'movie' | 'series' = rawKind === 'series' ? 'series' : 'movie'
  const activeGenre = genre && GENRES.includes(genre as (typeof GENRES)[number]) ? genre : null

  let items: Media[] = []
  let films: Media[] = []
  let shows: Media[] = []
  let playable: Media[] = []
  try {
    if (activeGenre) {
      items = await movies.byGenre(activeGenre, kind, 48)
    } else {
      ;[films, shows, playable] = await Promise.all([
        movies.popularMovies(24),
        movies.popularSeries(24),
        // The one shelf where every card is guaranteed to play.
        movies.playableNow(18).catch(() => []),
      ])
    }
  } catch {
    // Provider down: render the empty state rather than a 500.
  }

  const grid = (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((m, i) => (
        <PosterCard key={m.id} media={m} rank={i + 1} />
      ))}
    </div>
  )

  return (
    <div className="container-page animate-fade-in space-y-8">
      <header>
        <p className="eyebrow mb-1">Catalogue</p>
        <h1 className="section-title">{coverLabel('Movies & TV', covered)}</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Films and series, browsable by genre. Titles play when a public-domain
          copy exists; otherwise the detail page says so plainly.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1.5">
        <Link
          href="/movies"
          className={`chip transition-colors hover:bg-white/10 ${!activeGenre ? 'border-accent/50 text-accent-soft' : ''}`}
        >
          All
        </Link>
        {GENRES.map((g) => (
          <Link
            key={g}
            href={`/movies?genre=${encodeURIComponent(g)}`}
            className={`chip transition-colors hover:bg-white/10 ${
              activeGenre === g ? 'border-accent/50 text-accent-soft' : ''
            }`}
          >
            {g}
          </Link>
        ))}
      </nav>

      {activeGenre ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="section-title">{activeGenre}</h2>
            <div className="flex gap-2">
              {(['movie', 'series'] as const).map((k) => (
                <Link
                  key={k}
                  href={`/movies?genre=${encodeURIComponent(activeGenre)}&kind=${k}`}
                  className={`chip transition-colors hover:bg-white/10 ${
                    kind === k ? 'border-accent/50 text-accent-soft' : ''
                  }`}
                >
                  {k === 'movie' ? 'Films' : 'Series'}
                </Link>
              ))}
            </div>
          </div>
          {items.length ? grid : <EmptyState />}
        </section>
      ) : (
        <>
          {playable.length > 0 && (
            <section className="surface border-accent/20 p-4 sm:p-5">
              <div className="mb-3">
                <p className="eyebrow mb-1">Free to watch</p>
                <h2 className="section-title">{coverLabel('Playable now', covered)}</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Public-domain films with a verified stream. Every card here plays.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {playable.slice(0, 12).map((m) => (
                  <PosterCard key={m.id} media={m} />
                ))}
              </div>
            </section>
          )}
          {films.length > 0 && (
            <MediaRail
              title={coverLabel('Popular films', covered)}
              eyebrow="Catalogue"
              items={films}
              href="/movies?genre=Action&kind=movie"
            />
          )}
          {shows.length > 0 && (
            <MediaRail
              title={coverLabel('Popular series', covered)}
              eyebrow="Catalogue"
              items={shows}
              href="/movies?genre=Comedy&kind=series"
            />
          )}
          {!films.length && !shows.length && <EmptyState />}
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="surface p-8 text-center">
      <p className="text-sm text-zinc-400">Nothing to show right now.</p>
      <p className="mt-1 text-xs text-zinc-600">The catalogue provider did not answer.</p>
    </div>
  )
}
