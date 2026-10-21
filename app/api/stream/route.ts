import { NextRequest, NextResponse } from 'next/server'
import { providerHealth, resolveStream } from '@/lib/consumet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Resolve a playable stream for one episode.
 *
 * Query: anilistId, title, episode, [malId], [alt], [type=sub|dub]
 * `?health=1` instead probes every provider and reports reachability.
 */
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams

  if (p.get('health')) {
    return NextResponse.json({ providers: await providerHealth() })
  }

  const anilistId = Number(p.get('anilistId') ?? p.get('id'))
  const malIdRaw = Number(p.get('malId'))
  const episode = Number(p.get('episode'))
  const title = p.get('title') ?? ''
  const type = p.get('type') === 'dub' ? 'dub' : 'sub'

  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    return NextResponse.json({ error: 'anilistId is required' }, { status: 400 })
  }
  if (!Number.isFinite(episode) || episode <= 0) {
    return NextResponse.json({ error: 'episode is required' }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  try {
    const payload = await resolveStream({
      anilistId,
      malId: Number.isFinite(malIdRaw) && malIdRaw > 0 ? malIdRaw : null,
      title,
      altTitles: p.getAll('alt').filter(Boolean),
      episode,
      type,
    })

    // Hand the client proxy-wrapped URLs so playback is same-origin and the
    // provider's CORS/Referer requirements never reach the browser.
    const proxy = (u: string) =>
      `/api/proxy?url=${encodeURIComponent(u)}&referer=${encodeURIComponent(
        payload.headers.Referer ?? '',
      )}`

    return NextResponse.json({
      provider: payload.provider,
      sources: payload.sources.map((s) => ({ ...s, url: proxy(s.url) })),
      /** Raw urls kept server-side only for debugging via ?raw=1. */
      rawSources: p.get('raw') ? payload.sources : undefined,
      subtitles: payload.subtitles.map((s) => ({ ...s, url: proxy(s.url) })),
      headers: payload.headers,
      intro: payload.intro ?? null,
      outro: payload.outro ?? null,
      episode,
      type,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'stream resolution failed' },
      { status: 502 },
    )
  }
}
