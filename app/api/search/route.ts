import { NextRequest, NextResponse } from 'next/server'
import * as data from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The single search endpoint.
 *
 * Every search surface reads from here — the field in the top bar and the
 * results page — so there is one place to type and one source of truth. It used
 * to merge a second catalogue in; that catalogue is gone and this now fronts
 * AniList alone.
 */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const q = (params.get('q') ?? '').trim()
  const limit = Math.min(Math.max(Number(params.get('limit')) || 24, 1), 50)

  if (!q) return NextResponse.json({ results: [] })

  const res = await data.search({ q, page: 1, perPage: limit })
  const results = res.data.media ?? []
  return NextResponse.json({ results })
}
