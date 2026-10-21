import { NextRequest, NextResponse } from 'next/server'
import * as archive from '@/lib/archive'
import * as cinemeta from '@/lib/cinemeta'
import { adapt } from '@/lib/movies'

export const runtime = 'nodejs'
export const revalidate = 3600

/**
 * Films that can actually be played right now.
 *
 * The browse catalogues are built from what is popular, and almost none of that
 * is public domain — so a section built only from them would be all posters and
 * no playback. This route inverts the search: it starts from the Archive's
 * public feature films, then attaches real Cinemeta metadata to each.
 *
 * A title is only included when Cinemeta recognises it, because that is what
 * supplies a valid catalogue id and a full detail page. The match uses the same
 * strict title comparison the resolver uses, so a card here is one whose
 * playback will succeed.
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit')) || 18, 1), 40)

  try {
    const items = await archive.browse(limit * 2)
    const resolved = await Promise.all(
      items.map(async (item) => {
        const match = await cinemeta.search(item.title, 'movie', 3).catch(() => [])
        const hit = match.find((m) => archive.titlesMatch(m.name, item.title))
        return hit ? adapt(hit) : null
      }),
    )

    const seen = new Set<number>()
    const results = resolved
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
      .slice(0, limit)

    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json(
      { results: [], error: err instanceof Error ? err.message : 'failed' },
      { status: 200 },
    )
  }
}
