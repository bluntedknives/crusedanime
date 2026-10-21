import { NextRequest } from 'next/server'
import { decodeTarget, encodeTarget } from '@/lib/cover'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const M3U8 = /mpegurl|m3u8/i
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Range,Content-Type,Origin,Accept',
    'Access-Control-Expose-Headers':
      'Content-Length,Content-Range,Content-Type,Accept-Ranges',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...extra,
  }
}

/** Reject anything that is not a plain http(s) URL to avoid SSRF-ish inputs. */
function parseTarget(raw: string | null): URL | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null
  const host = url.hostname.toLowerCase()
  // Block loopback / link-local / metadata endpoints.
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host === 'metadata.google.internal' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null
  }
  return url
}

/**
 * Rewrite an HLS playlist so every child URI is routed back through this
 * proxy. Handles variant playlists, media (audio/subtitle) groups, keys and
 * relative segment paths.
 */
function rewritePlaylist(
  body: string,
  base: URL,
  referer: string,
  /** Origin of this app, so rewritten URIs point back here (not upstream). */
  selfOrigin: string,
  contentType: string | null,
): string {
  const origin = selfOrigin
  const proxied = (target: string) => {
    let abs: string
    try {
      abs = new URL(target, base).toString()
    } catch {
      return target
    }
    // The target is base64url-encoded rather than escaped, so the upstream host
    // never appears in the playlist or in any request an extension can observe.
    return `${origin}/api/proxy?t=${encodeTarget(abs, referer)}`
  }

  // Subtitle playlists are WebVTT/segments; rewriting their relative paths is
  // still correct, so no special casing beyond not touching cue text.
  void contentType

  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line

      if (trimmed.startsWith('#')) {
        // Rewrite URI="..." attributes (EXT-X-KEY, EXT-X-MEDIA, EXT-X-MAP, ...)
        return line.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${proxied(uri)}"`)
      }

      // Bare URI line: variant playlist, segment, or key file.
      return proxied(trimmed)
    })
    .join('\n')
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

/**
 * The server binds to localhost inside the container, so `req.url` carries the
 * internal origin. When the app is reached through a proxy or port-forward the
 * rewritten playlist URIs must point at the origin the browser actually used,
 * otherwise HLS resolves them against localhost and fails.
 */
function requestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
    return `${proto}://${forwardedHost.split(',')[0].trim()}`
  }
  return new URL(req.url).origin
}

/**
 * Resolve the request target from either the encoded `t` token (preferred) or
 * the legacy `url`/`referer` params, which older playlists may still carry.
 */
function readTarget(searchParams: URLSearchParams): { target: URL; referer: string } | null {
  const token = searchParams.get('t')
  if (token) {
    const decoded = decodeTarget(token)
    if (!decoded) return null
    const target = parseTarget(decoded.url)
    if (!target) return null
    return { target, referer: decoded.referer || `${target.origin}/` }
  }
  const target = parseTarget(searchParams.get('url'))
  if (!target) return null
  return { target, referer: searchParams.get('referer') || `${target.origin}/` }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const resolved = readTarget(searchParams)
  const target = resolved?.target
  if (!target) {
    return new Response(JSON.stringify({ error: 'invalid or disallowed url' }), {
      status: 400,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    })
  }

  const referer = resolved.referer
  const range = req.headers.get('range')

  const upstreamHeaders: Record<string, string> = {
    'User-Agent': UA,
    Accept: '*/*',
    Referer: referer,
    Origin: (() => {
      try {
        return new URL(referer).origin
      } catch {
        return target.origin
      }
    })(),
  }
  if (range) upstreamHeaders.Range = range

  let upstream: Response
  try {
    upstream = await fetch(target.toString(), {
      headers: upstreamHeaders,
      redirect: 'follow',
      cache: 'no-store',
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'upstream fetch failed', detail: String(err) }),
      { status: 502, headers: corsHeaders({ 'Content-Type': 'application/json' }) },
    )
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(
      JSON.stringify({ error: `upstream ${upstream.status}`, url: target.toString() }),
      {
        status: upstream.status === 404 ? 404 : 502,
        headers: corsHeaders({ 'Content-Type': 'application/json' }),
      },
    )
  }

  const contentType = upstream.headers.get('content-type')

  // Signed CDN URLs share one shape for both playlists and media segments, so
  // the URL cannot be trusted to identify a playlist. Only a playlist content
  // type is definitive; anything else is passed through as raw bytes so binary
  // segments are never run through a UTF-8 decode.
  const definitelyPlaylist = M3U8.test(contentType ?? '')

  if (definitelyPlaylist) {
    const text = await upstream.text()
    if (text.trimStart().startsWith('#EXTM3U')) {
      const body = rewritePlaylist(text, target, referer, requestOrigin(req), contentType)
      return new Response(body, {
        status: 200,
        headers: corsHeaders({
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store',
        }),
      })
    }
    // Signed JSON manifest leaking through the playlist heuristic.
    return new Response(text, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': text.trimStart().startsWith('{') ? 'application/json' : 'text/plain',
        'Cache-Control': 'no-store',
      }),
    })
  }

  const isBinary = /^(video|audio|image|application\/octet-stream|application\/vnd\.mp2t)/i.test(
    contentType ?? '',
  )
  const looksLikePlaylistByPath = /\.m3u8(\?|$)/i.test(target.pathname + target.search)

  // Ambiguous responses (text/plain or a bare .m3u8) are buffered once so the
  // bytes can be inspected without corrupting a binary payload.
  if (!isBinary && (looksLikePlaylistByPath || !contentType)) {
    const buf = Buffer.from(await upstream.arrayBuffer())
    const head = buf.subarray(0, 64).toString('latin1')
    if (head.trimStart().startsWith('#EXTM3U')) {
      const body = rewritePlaylist(
        buf.toString('utf8'),
        target,
        referer,
        requestOrigin(req),
        contentType,
      )
      return new Response(body, {
        status: 200,
        headers: corsHeaders({
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store',
        }),
      })
    }
    return new Response(buf, {
      status: upstream.status,
      headers: corsHeaders({
        'Content-Type': contentType ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': String(buf.length),
      }),
    })
  }

  const headers = corsHeaders({
    'Content-Type': contentType ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=3600',
  })
  const len = upstream.headers.get('content-length')
  const acceptRanges = upstream.headers.get('accept-ranges')
  const contentRange = upstream.headers.get('content-range')
  if (len) headers['Content-Length'] = len
  if (acceptRanges) headers['Accept-Ranges'] = acceptRanges
  if (contentRange) headers['Content-Range'] = contentRange

  // Stream straight through so large segments never buffer in memory.
  return new Response(upstream.body, { status: upstream.status, headers })
}

export async function HEAD(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const resolved = readTarget(searchParams)
  const target = resolved?.target
  if (!target) return new Response(null, { status: 400, headers: corsHeaders() })

  try {
    const upstream = await fetch(target.toString(), {
      method: 'HEAD',
      headers: { 'User-Agent': UA, Referer: resolved.referer },
      cache: 'no-store',
    })
    return new Response(null, {
      status: upstream.status,
      headers: corsHeaders({
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        ...(upstream.headers.get('content-length')
          ? { 'Content-Length': upstream.headers.get('content-length') as string }
          : {}),
      }),
    })
  } catch {
    return new Response(null, { status: 502, headers: corsHeaders() })
  }
}
