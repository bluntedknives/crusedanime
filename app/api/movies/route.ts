import { NextRequest, NextResponse } from 'next/server'
import * as movies from '@/lib/movies'
import { GENRES } from '@/lib/cinemeta'

export const runtime = 'nodejs'
export const revalidate = 1800

/**
 * Movie and series catalogue.
 *
 * Query: `?kind=movie|series&genre=&q=&limit=`. With no parameters it returns
 * the browse payload (popular films plus popular series) so the browse page is
 * a single round trip.
 */
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams
  const limit = Math.min(Math.max(Number(p.get('limit')) || 24, 1), 50)
  const kind = p.get('kind') === 'series' ? 'series' : 'movie'
  const genre = p.get('genre')
  const q = p.get('q')

  try {
    if (q) {
      return NextResponse.json({ results: await movies.search(q, limit) })
    }
    if (genre && GENRES.includes(genre as (typeof GENRES)[number])) {
      return NextResponse.json({ results: await movies.byGenre(genre, kind, limit) })
    }
    const [films, shows] = await Promise.all([
      movies.popularMovies(limit),
      movies.popularSeries(limit),
    ])
    return NextResponse.json({ films, shows, genres: GENRES })
  } catch (err) {
    return NextResponse.json(
      {
        films: [],
        shows: [],
        results: [],
        genres: GENRES,
        error: err instanceof Error ? err.message : 'failed',
      },
      { status: 200 },
    )
  }
}
