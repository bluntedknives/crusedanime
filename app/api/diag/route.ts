import { NextResponse } from 'next/server'
import { resolveStream } from '@/lib/consumet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/**
 * Temporary: can ONE invocation mint and then fetch a real media segment?
 * Also times each hop, to decide whether a per-segment tunnel is viable.
 */
export async function GET() {
  const out: Record<string, unknown> = {}
  const t: Record<string, number> = {}
  const mark = (k: string) => {
    t[k] = Math.round(performance.now())
  }

  try {
    const r = await fetch('https://api.ipify.org/?diag=2', { cache: 'no-store' })
    out.egressIp = await r.text()
  } catch (e) {
    out.egressIp = String(e)
  }

  try {
    mark('start')
    const payload = await resolveStream({
      anilistId: 113415,
      malId: 40748,
      title: 'Jujutsu Kaisen',
      episode: 1,
      type: 'sub',
    })
    mark('resolved')
    out.provider = payload.provider
    const src = payload.sources[0]?.url
    if (!src) return NextResponse.json({ ...out, error: 'no source' })
    out.rawSource = src.slice(0, 70)

    const hdr = {
      'User-Agent': UA,
      Referer: payload.headers.Referer ?? '',
      Accept: '*/*',
    }
    const get = (u: string) =>
      fetch(u, { headers: hdr, redirect: 'follow', cache: 'no-store' })

    // master -> media playlist
    const master = await get(src)
    const masterText = await master.text()
    out.masterStatus = master.status
    const child = masterText
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'))
    if (!child) return NextResponse.json({ ...out, error: 'no child' })
    const childUrl = new URL(child, src).toString()
    mark('master')

    // media playlist -> segment list
    const media = await get(childUrl)
    const mediaText = await media.text()
    out.mediaStatus = media.status
    out.segmentCount = mediaText
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#')).length
    const seg0 = mediaText
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'))
    if (!seg0) return NextResponse.json({ ...out, error: 'no segment' })
    const segUrl = new URL(seg0, childUrl).toString()
    mark('media')

    // THE TEST: a real media segment, same invocation, same egress IP
    const seg = await get(segUrl)
    const buf = new Uint8Array(await seg.arrayBuffer())
    out.segmentStatus = seg.status
    out.segmentBytes = buf.length
    out.segmentType = seg.headers.get('content-type')
    out.segmentMagic = Array.from(buf.slice(0, 4))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
    mark('segment')
    out.timing = {
      resolveMs: t.resolved - t.start,
      masterMs: t.master - t.resolved,
      mediaMs: t.media - t.master,
      segmentMs: t.segment - t.media,
      totalMs: t.segment - t.start,
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(out)
}
