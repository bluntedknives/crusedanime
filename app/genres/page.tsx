import type { Metadata } from 'next'
import Link from 'next/link'
import * as data from '@/lib/data'
import { IconGrid2 } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Genres',
  description: 'Browse anime by genre.',
}

// The genre list is effectively static; there is no reason to refetch per hit.
export const revalidate = 86_400

/** Genres with a representative colour, so the grid is scannable at a glance. */
const TONES: Record<string, string> = {
  Action: 'from-rose-500/25',
  Adventure: 'from-amber-500/25',
  Comedy: 'from-yellow-400/25',
  Drama: 'from-purple-500/25',
  Ecchi: 'from-pink-500/25',
  Fantasy: 'from-emerald-500/25',
  Horror: 'from-red-700/30',
  Mahou: 'from-fuchsia-500/25',
  Mecha: 'from-slate-400/25',
  Music: 'from-cyan-400/25',
  Mystery: 'from-indigo-500/25',
  Psychological: 'from-violet-600/25',
  Romance: 'from-pink-400/25',
  'Sci-Fi': 'from-sky-500/25',
  'Slice of Life': 'from-teal-400/25',
  Sports: 'from-orange-500/25',
  Supernatural: 'from-purple-700/30',
  Thriller: 'from-red-500/25',
}

/**
 * Genres that only ever describe adult titles.
 *
 * The catalogue queries behind /search exclude adult media, so a chip for one
 * of these would link to a page that is always empty.
 */
const ADULT_ONLY = new Set(['Hentai'])

export default async function GenresPage() {
  const { data: all } = await data.genres()
  const genres = all.filter((g) => !ADULT_ONLY.has(g))

  // The catalogue source is not guaranteed to answer; say so rather than
  // rendering an empty grid that looks broken.
  if (!genres.length) {
    return (
      <div className="container-page py-10">
        <h1 className="text-2xl font-semibold text-zinc-100">Genres</h1>
        <p className="mt-3 text-sm text-zinc-400">
          The catalogue is not responding right now. Try again in a moment.
        </p>
        <Link href="/search" className="btn-primary mt-5">
          Search instead
        </Link>
      </div>
    )
  }

  return (
    <div className="container-page py-8">
      <header className="mb-8">
        <p className="eyebrow">Browse</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-zinc-100">
          <IconGrid2 size={22} className="text-accent" />
          Genres
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Pick a genre to see the most popular titles in it.</p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {genres.map((g) => (
          <li key={g}>
            <Link
              href={`/search?genre=${encodeURIComponent(g)}`}
              className="group relative block overflow-hidden rounded-lg border border-white/[0.07] bg-base-800 p-5 transition-colors hover:border-accent/50"
            >
              <span
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-70 transition-opacity group-hover:opacity-100 ${
                  TONES[g] ?? 'from-white/[0.06]'
                }`}
              />
              <span className="relative text-sm font-medium text-zinc-100 group-hover:text-white">
                {g}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
