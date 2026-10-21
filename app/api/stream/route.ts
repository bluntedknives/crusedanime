import { NextRequest, NextResponse, after } from 'next/server'
import { providerHealth, resolveStream, type ResolveStreamInput } from '@/lib/consumet'
import { encodeTarget } from '@/lib/cover'
import * as movies from '@/lib/movies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

  // A negative id is a film or series from the movie catalogue, which resolves
  // through a different provider entirely. Branching here keeps the client
  // contract identical, so the player needs no knowledge of the difference.
  if (movies.isMovieId(anilistId)) {
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    const year = Number(p.get('year'))
    try {
      const hit = await movies.sourceFor(anilistId, title, Number.isFinite(year) ? year : null)
      if (!hit) {
        return NextResponse.json({
          unavailable: true,
          reason: 'no-public-source',
          sources: [],
          subtitles: [],
          headers: {},
        })
      }
      const proxied = `/api/proxy?t=${encodeTarget(hit.source.url)}`
      return NextResponse.json({
        provider: 'archive',
        sources: [{ url: proxied, quality: 'auto', isM3U8: hit.source.kind === 'm3u8' }],
        subtitles: [],
        headers: {},
        // Native MP4 needs no HLS shim; the client reads this to pick a path.
        native: hit.source.kind === 'mp4',
        intro: null,
        outro: null,
      })
    } catch (err) {
      return NextResponse.json(
        { unavailable: true, reason: err instanceof Error ? err.message : 'resolve failed', sources: [] },
        { status: 200 },
      )
    }
  }

  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    return NextResponse.json({ error: 'anilistId is required' }, { status: 400 })
  }
  if (!Number.isFinite(episode) || episode <= 0) {
    return NextResponse.json({ error: 'episode is required' }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  // Prefetch: resolve and cache without making the caller wait. Upstream
  // resolution can take tens of seconds, far too long for a user to sit on a
  // spinner, so the detail page warms this instead. `after` keeps the work
  // alive past the response, which a bare floating promise would not.
  if (p.get('warm')) {
    const warmInput: ResolveStreamInput = {
      anilistId,
      malId: Number.isFinite(malIdRaw) && malIdRaw > 0 ? malIdRaw : null,
      title,
      altTitles: p.getAll('alt').filter(Boolean),
      episode,
      type,
    }
    after(async () => {
      try {
        await resolveStream(warmInput)
      } catch {
        /* a failed warm is harmless; the real request will retry */
      }
    })
    return NextResponse.json({ warming: true })
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
    // provider's CORS/Referer requirements never reach the browser. The target
    // is tokenised rather than escaped: a bare `?url=` would put the upstream
    // host in the URL, where an extension can read it.
    const proxy = (u: string) => `/api/proxy?t=${encodeTarget(u, payload.headers.Referer ?? '')}`

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
