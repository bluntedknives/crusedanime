import { NextRequest, NextResponse } from 'next/server'
import { getEpisodes } from '@/lib/consumet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Provider episode list for a title. Falls back to an AniList-derived count
 * when the provider has no entry, so the UI can always render a list.
 */
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams
  const anilistId = Number(p.get('anilistId') ?? p.get('id'))
  const malIdRaw = Number(p.get('malId'))
  const title = p.get('title') ?? ''
  const totalRaw = Number(p.get('totalEpisodes'))

  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    return NextResponse.json({ error: 'anilistId is required' }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  try {
    const episodes = await getEpisodes({
      anilistId,
      malId: Number.isFinite(malIdRaw) && malIdRaw > 0 ? malIdRaw : null,
      title,
      altTitles: p.getAll('alt').filter(Boolean),
      totalEpisodes: Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : null,
    })
    return NextResponse.json({ episodes })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed to load episodes' },
      { status: 502 },
    )
  }
}
