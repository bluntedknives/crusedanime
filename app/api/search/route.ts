import { NextRequest, NextResponse } from 'next/server'
import * as data from '@/lib/data'
import * as movies from '@/lib/movies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * One search across both catalogues.
 *
 * The app holds two independent catalogues (AniList anime, Cinemeta films and
 * series) and they were previously searched separately: the search page queried
 * one, the field in the top bar queried the other, and a title living in the
 * second was invisible to whichever surface you happened to use. This endpoint
 * is the single answer to "find me this", and both surfaces read from it.
 *
 * The two upstreams are hit in parallel and merged. A failure on one side is not
 * a failure of the search — if AniList is slow or down, films still come back,
 * and vice versa.
 */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const q = (params.get('q') ?? '').trim()
  const limit = Math.min(Math.max(Number(params.get('limit')) || 24, 1), 50)

  if (!q) return NextResponse.json({ results: [], anime: [], movies: [] })

  const [animeRes, movieRes] = await Promise.allSettled([
    data.search({ q, page: 1, perPage: limit }),
    movies.search(q, limit),
  ])

  const anime = animeRes.status === 'fulfilled' ? (animeRes.value.data.media ?? []) : []
  const films = movieRes.status === 'fulfilled' ? (movieRes.value ?? []) : []

  // Anime first — it is the larger catalogue and the app's original focus — then
  // films and series. The client renders them as two labelled groups, so the
  // order here only matters for the flat list.
  return NextResponse.json({
    results: [...anime, ...films],
    anime,
    movies: films,
    errors: {
      anime: animeRes.status === 'rejected' ? String(animeRes.reason) : null,
      movies: movieRes.status === 'rejected' ? String(movieRes.reason) : null,
    },
  })
}
