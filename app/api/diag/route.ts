import { NextResponse } from 'next/server'
import { resolveStream } from '@/lib/consumet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/**
 * Temporary: does one invocation share a single egress IP end to end?
 * Mints, then fetches the manifest, from the same lambda.
 */
export async function GET() {
  const out: Record<string, unknown> = {}
  try {
    const r = await fetch('https://api.ipify.org/?diag=1', { cache: 'no-store' })
    out.egressIp = await r.text()
  } catch (e) {
    out.egressIp = String(e)
  }

  try {
    const payload = await resolveStream({
      anilistId: 113415,
      malId: 40748,
      title: 'Jujutsu Kaisen',
      episode: 1,
      type: 'sub',
    })
    out.provider = payload.provider
    out.embedUrl = payload.embedUrl ?? null
    const src = payload.sources[0]?.url
    out.rawSource = src ? src.slice(0, 90) : null
    if (src) {
      // Same invocation, same egress: this is the test that matters.
      const res = await fetch(src, {
        headers: { 'User-Agent': UA, Referer: payload.headers.Referer ?? '', Accept: '*/*' },
        redirect: 'follow',
        cache: 'no-store',
      })
      out.manifestStatus = res.status
      const text = await res.text()
      out.manifestHead = text.slice(0, 80)
      const child = text
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith('#'))
      if (child) {
        try {
          const seg = await fetch(new URL(child, src).toString(), {
            headers: { 'User-Agent': UA, Referer: payload.headers.Referer ?? '' },
            redirect: 'follow',
            cache: 'no-store',
          })
          out.segmentStatus = seg.status
          out.segmentType = seg.headers.get('content-type')
        } catch (e) {
          out.segmentError = String(e)
        }
      }
    }
  } catch (e) {
    out.resolveError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(out)
}
