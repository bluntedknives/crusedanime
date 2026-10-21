import { NextRequest, NextResponse } from 'next/server'
import * as anilist from '@/lib/anilist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Thin server-side facade over the AniList client. Pages call this so the
 * GraphQL query strings stay out of the client bundle and the in-memory cache
 * is shared across every request in the process.
 */
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams
  const action = p.get('action') ?? 'trending'

  const num = (k: string, d: number) => {
    const v = Number(p.get(k))
    return Number.isFinite(v) && v > 0 ? v : d
  }

  try {
    switch (action) {
      case 'trending':
        return NextResponse.json({
          media: await anilist.trending(num('page', 1), num('perPage', 20)),
        })

      case 'popular':
        return NextResponse.json({
          media: await anilist.popular(num('page', 1), num('perPage', 20)),
        })

      case 'top':
        return NextResponse.json({
          media: await anilist.topRated(num('page', 1), num('perPage', 20)),
        })

      case 'airing':
        return NextResponse.json({
          media: await anilist.airingNow(num('page', 1), num('perPage', 20)),
        })

      case 'search': {
        const scoreMin = Number(p.get('scoreMin'))
        const year = Number(p.get('year'))
        const page = await anilist.search({
          q: p.get('q') ?? undefined,
          genres: p.getAll('genre').filter(Boolean),
          year: Number.isFinite(year) && year > 0 ? year : null,
          season: (p.get('season') as anilist.MediaSeason) || null,
          format: (p.get('format') as anilist.MediaFormat) || null,
          status: (p.get('status') as anilist.MediaStatus) || null,
          scoreMin: Number.isFinite(scoreMin) && scoreMin > 0 ? scoreMin : null,
          studio: p.get('studio') || null,
          sort: p.getAll('sort').filter(Boolean),
          page: num('page', 1),
          perPage: Math.min(num('perPage', 30), 50),
        })
        return NextResponse.json(page)
      }

      case 'byId': {
        const id = Number(p.get('id'))
        if (!Number.isFinite(id) || id <= 0) {
          return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }
        return NextResponse.json({ media: await anilist.byId(id) })
      }

      case 'schedule': {
        const from = Number(p.get('from'))
        const to = Number(p.get('to'))
        if (!Number.isFinite(from) || !Number.isFinite(to)) {
          return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
        }
        const page = await anilist.airingSchedule(
          from,
          to,
          num('page', 1),
          Math.min(num('perPage', 50), 50),
        )
        return NextResponse.json(page)
      }

      case 'genres':
        return NextResponse.json({ genres: await anilist.genres() })

      case 'studios':
        return NextResponse.json({ studios: await anilist.studioSearch(p.get('q') ?? '') })

      default:
        return NextResponse.json({ error: `unknown action "${action}"` }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'request failed'
    const status =
      err instanceof Error && 'status' in err && typeof err.status === 'number' ? err.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
