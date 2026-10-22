import { NextRequest, NextResponse, after } from 'next/server'
import { providerHealth, resolveStream, type ResolveStreamInput } from '@/lib/consumet'
import { encodeTarget } from '@/lib/cover'

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

    /*
     * Both playback paths are returned and the client picks.
     *
     * `sources` go through this app's proxy, which is the better experience —
     * native controls, subtitle tracks, intro/outro skipping — but only works
     * where the server keeps one egress IP, because the CDN signs every URL
     * against the address that requested it.
     *
     * `embedUrl` is the provider's own player page. The browser fetches it
     * directly, so mint and fetch share one IP and it works anywhere, at the
     * cost of a cross-origin frame the app cannot instrument. The client falls
     * back to it when the proxied source fails.
     */
    return NextResponse.json({
      provider: payload.provider,
      embedUrl: payload.embedUrl ?? null,
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
