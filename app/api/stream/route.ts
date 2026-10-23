import { NextRequest, NextResponse, after } from 'next/server'
import { providerHealth, resolveStream } from '@/lib/consumet'
import { TunnelError, tunnelFor } from '@/lib/tunnel'
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
/** Origin the browser used, so tunnel tokens point back at this deployment. */
function requestOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host')
  if (host) {
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
    return `${proto}://${host.split(',')[0].trim()}`
  }
  return req.nextUrl.origin
}

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
    const malId = Number.isFinite(malIdRaw) && malIdRaw > 0 ? malIdRaw : null
    after(async () => {
      try {
        // Warming the tunnel matters most: it is the path playback takes, and
        // the chain it caches is what lets the first segment request hit a warm
        // instance rather than paying for a cold resolve.
        await tunnelFor({ anilistId, malId, episode, type, origin: requestOrigin(req) })
      } catch {
        /* a failed warm is harmless; the real request will retry */
      }
      try {
        await resolveStream({
          anilistId,
          malId,
          title,
          altTitles: p.getAll('alt').filter(Boolean),
          episode,
          type,
        })
      } catch {
        /* the scrape-based fallback is best-effort */
      }
    })
    return NextResponse.json({ warming: true })
  }

  try {
    /*
     * The tunnel is the primary path. It builds the signed-URL chain inside
     * whichever invocation serves the request, so mint and fetch always share
     * one egress IP — the property the CDN requires and a separate proxy route
     * cannot provide. `resolveStream` stays as the fallback for episodes the
     * direct embed path cannot address.
     */
    const origin = requestOrigin(req)
    try {
      const tunnel = await tunnelFor({
        anilistId,
        malId: Number.isFinite(malIdRaw) && malIdRaw > 0 ? malIdRaw : null,
        episode,
        type,
        origin,
      })
      if (tunnel.sources.length) {
        return NextResponse.json({
          provider: tunnel.provider,
          embedUrl: tunnel.embedUrl,
          sources: tunnel.sources,
          subtitles: tunnel.subtitles,
          headers: {},
          intro: tunnel.intro,
          outro: tunnel.outro,
          episode,
          type,
          tunnel: true,
        })
      }
    } catch (err) {
      /*
       * The tunnel is the path that produces subtitles and native controls, so
       * if it cannot build a chain the provider's own player page is still a
       * working answer. Returning it here avoids falling through to the
       * scrape-based resolver, which can spend the whole function budget on a
       * title whose upstream never responds — the caller would see a gateway
       * timeout instead of a playable page.
       */
      if (err instanceof TunnelError && err.embedUrl) {
        return NextResponse.json({
          provider: 'zangetsu:embed',
          embedUrl: err.embedUrl,
          sources: [],
          subtitles: [],
          headers: {},
          intro: null,
          outro: null,
          episode,
          type,
          tunnel: false,
        })
      }
      // Any other failure falls through to the scrape-based resolver.
      if (p.get('debug')) console.error('tunnel failed', err)
    }

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
