import { NextRequest, NextResponse } from 'next/server'
import * as data from '@/lib/data'
import * as anilist from '@/lib/anilist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The single search endpoint.
 *
 * Every search surface reads from here — the field in the top bar and the
 * results page — so there is one place to type and one source of truth.
 *
 * `deep=1` additionally resolves matching studios and staff, so a name like
 * "Ufotable" or "Yuasa" leads somewhere instead of returning an empty grid.
 */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const q = (params.get('q') ?? '').trim()
  const limit = Math.min(Math.max(Number(params.get('limit')) || 24, 1), 50)
  const deep = params.get('deep') === '1'

  if (!q) return NextResponse.json({ results: [], staff: [], studios: [] })

  if (deep) {
    try {
      const { page, staff, studios } = await anilist.searchDeep({ q, perPage: limit })
      return NextResponse.json({ results: page.media ?? [], staff, studios })
    } catch {
      // Fall through to the plain search below.
    }
  }

  const res = await data.search({ q, page: 1, perPage: limit })
  return NextResponse.json({ results: res.data.media ?? [], staff: [], studios: [] })
}
