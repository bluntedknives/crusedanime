import { NextRequest, NextResponse } from 'next/server'
import {
  decodeToken,
  ensurePlaylist,
  fetchSegment,
  fetchSubtitle,
  getChain,
  rewritePlaylist,
} from '@/lib/tunnel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Playback endpoint for the tokenised stream tunnel.
 *
 * The signed CDN urls behind this cannot be fetched from an invocation other
 * than the one that minted them, so this route never accepts an upstream url
 * from the client. It takes a position in the chain, re-derives the chain on
 * this instance, and fetches from here — see lib/tunnel.ts.
 */

function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Range,Content-Type,Origin,Accept',
    'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Content-Type,Accept-Ranges',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...extra,
  }
}

/** Origin the browser actually used, so rewritten urls point back at us. */
function requestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
    return `${proto}://${forwardedHost.split(',')[0].trim()}`
  }
  return new URL(req.url).origin
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function GET(req: NextRequest) {
  const t = decodeToken(new URL(req.url).searchParams.get('t'))
  if (!t) {
    return new Response(JSON.stringify({ error: 'invalid token' }), {
      status: 400,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    })
  }

  let chain
  try {
    chain = await getChain(t)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'chain failed' }),
      { status: 502, headers: corsHeaders({ 'Content-Type': 'application/json' }) },
    )
  }

  try {
    // A verbatim url is the one case that still leaves this instance, so it is
    // only used for auxiliary files (keys, iframe playlists) where a miss is
    // recoverable.
    if (t.k === 'u') {
      const res = await fetch(t.u as string, {
        headers: { Referer: chain.embed, Origin: chain.embed },
        redirect: 'follow',
        cache: 'no-store',
      })
      const body = await res.arrayBuffer()
      return new Response(body, {
        status: res.status,
        headers: corsHeaders({
          'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
          'Cache-Control': 'public, max-age=600',
        }),
      })
    }

    if (t.k === 't') {
      const res = await fetchSubtitle(chain, t.i ?? 0)
      const text = await res.text()
      return new Response(text, {
        status: res.status,
        headers: corsHeaders({
          'Content-Type': 'text/vtt; charset=utf-8',
          'Cache-Control': 'public, max-age=600',
        }),
      })
    }

    if (t.k === 's') {
      const n = t.n ?? 0
      const j = t.j ?? 0
      const res = await fetchSegment(chain, n, j, req.headers.get('range'))
      const headers = corsHeaders({
        'Content-Type': res.headers.get('content-type') ?? 'video/mp2t',
        'Cache-Control': 'public, max-age=3600',
      })
      for (const h of ['content-length', 'content-range', 'accept-ranges']) {
        const v = res.headers.get(h)
        if (v) headers[h.replace(/(^|-)([a-z])/g, (_, a, b) => a + b.toUpperCase())] = v
      }
      return new Response(res.body, { status: res.status, headers })
    }

    // Playlist: load it (and any playlists before it) then rewrite its children
    // into tokens for this route.
    const n = t.n ?? 0
    await ensurePlaylist(chain, n)
    const text = chain.text.get(n)
    if (text === undefined) throw new Error(`playlist ${n} was not loaded`)

    const body = rewritePlaylist(text, chain.flat[n], chain, n, requestOrigin(req), t)
    return new Response(body, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      }),
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'upstream failed' }),
      { status: 502, headers: corsHeaders({ 'Content-Type': 'application/json' }) },
    )
  }
}

export async function HEAD(req: NextRequest) {
  const t = decodeToken(new URL(req.url).searchParams.get('t'))
  if (!t) return new Response(null, { status: 400, headers: corsHeaders() })
  return new Response(null, {
    status: 200,
    headers: corsHeaders({ 'Content-Type': 'application/octet-stream' }),
  })
}
