import { NextRequest, NextResponse } from 'next/server'
import * as anilist from '@/lib/anilist'
import * as data from '@/lib/data'
import * as preview from '@/lib/preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Metadata endpoint. Requests go through lib/data, which chains the live
 * providers (AniList, then Kitsu) before ever touching the offline seed set, so
 * `preview: true` genuinely means "these are placeholders".
 *
 * `?preview=1` pins the seed set for UI work.
 */
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams
  const action = p.get('action') ?? 'trending'

  const num = (k: string, d: number) => {
    const v = Number(p.get(k))
    return Number.isFinite(v) && v > 0 ? v : d
  }

  // A client that spread an object of optional fields into URLSearchParams can
  // send the literal text "undefined"/"null"; treat those as absent
  // rather than forwarding them to the provider as a real filter value.
  const str = (k: string): string | null => {
    const v = p.get(k)
    if (v == null) return null
    const t = v.trim()
    if (!t || t === 'undefined' || t === 'null') return null
    return t
  }

  const list = (key: string) =>
    p
      .getAll(key)
      .flatMap((v) => v.split(','))
      .map((v) => v.trim())
      .filter((v) => v && v !== 'undefined' && v !== 'null')

  if (str('preview') === '1') {
    return NextResponse.json({ ...previewResponse(action, p, num, str, list), preview: true })
  }

  const shape = <T>(r: data.Result<T>, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ ...extra, preview: r.preview })

  switch (action) {
    case 'trending': {
      const r = await data.trending(num('page', 1), num('perPage', 20))
      return shape(r, { media: r.data })
    }

    case 'popular': {
      const r = await data.popular(num('page', 1), num('perPage', 20))
      return shape(r, { media: r.data })
    }

    case 'top': {
      const r = await data.topRated(num('page', 1), num('perPage', 20))
      return shape(r, { media: r.data })
    }

    case 'airing': {
      const r = await data.airingNow(num('page', 1), num('perPage', 20))
      return shape(r, { media: r.data })
    }

    case 'search': {
      const scoreMin = Number(p.get('scoreMin'))
      const year = Number(p.get('year'))
      const r = await data.search({
        q: str('q') ?? undefined,
        genres: list('genre'),
        year: Number.isFinite(year) && year > 0 ? year : null,
        season: (str('season') as anilist.MediaSeason) ?? null,
        format: (str('format') as anilist.MediaFormat) ?? null,
        status: (str('status') as anilist.MediaStatus) ?? null,
        scoreMin: Number.isFinite(scoreMin) && scoreMin > 0 ? scoreMin : null,
        studio: str('studio'),
        sort: list('sort'),
        page: num('page', 1),
        perPage: Math.min(num('perPage', 30), 50),
      })
      return NextResponse.json({ ...r.data, preview: r.preview })
    }

    case 'byId': {
      const raw = p.get('id')
      const id = Number(raw)
      if (raw == null || !Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 })
      }
      const r = await data.byId(id)
      // An id that matches nothing is a genuine miss, not something to paper
      // over with an unrelated title.
      if (!r.data) {
        return NextResponse.json({ error: 'not found', preview: r.preview }, { status: 404 })
      }
      return NextResponse.json({ media: r.data, preview: r.preview })
    }

    case 'schedule': {
      const from = Number(p.get('from'))
      const to = Number(p.get('to'))
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
      }
      const r = await data.schedule(from, to)
      return NextResponse.json({
        pageInfo: {
          total: r.data.length,
          currentPage: 1,
          lastPage: 1,
          hasNextPage: false,
          perPage: r.data.length,
        },
        airingSchedules: r.data,
        approximate: r.approximate,
        preview: r.preview,
      })
    }

    case 'genres': {
      const r = await data.genres()
      return shape(r, { genres: r.data })
    }

    case 'studios':
      return NextResponse.json({ studios: await anilist.studioSearch(p.get('q') ?? '') })

    default:
      return NextResponse.json({ error: `unknown action "${action}"` }, { status: 400 })
  }
}

/** Shape a preview payload to match the live response for the same action. */
function previewResponse(
  action: string,
  p: URLSearchParams,
  num: (k: string, d: number) => number,
  str: (k: string) => string | null,
  list: (k: string) => string[],
): Record<string, unknown> {
  switch (action) {
    case 'search': {
      const scoreMin = Number(p.get('scoreMin'))
      const year = Number(p.get('year'))
      return preview.previewSearch({
        q: str('q') ?? undefined,
        genres: list('genre'),
        year: Number.isFinite(year) && year > 0 ? year : null,
        season: str('season'),
        format: str('format'),
        status: str('status'),
        scoreMin: Number.isFinite(scoreMin) && scoreMin > 0 ? scoreMin : null,
        sort: list('sort'),
      })
    }
    case 'byId': {
      const id = Number(p.get('id'))
      const media = preview.previewById(id)
      return media ? { media } : { media: preview.previewMedia()[0] }
    }
    case 'schedule':
      return {
        pageInfo: { total: 7, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 7 },
        airingSchedules: preview.previewSchedule(),
      }
    case 'genres':
      return { genres: PREVIEW_GENRES }
    case 'studios':
      return { studios: [] }
    default:
      return { media: preview.previewMedia().slice(0, Math.min(num('perPage', 20), 20)) }
  }
}

const PREVIEW_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Suspense',
  'Thriller',
]
