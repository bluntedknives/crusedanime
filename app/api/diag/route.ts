import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

// Module scope survives while the lambda instance stays warm.
const store: { seg?: string; ref?: string; ip?: string } = {}

async function ip(): Promise<string> {
  try {
    const r = await fetch('https://api.ipify.org/?warm=1', { cache: 'no-store' })
    return (await r.text()).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Temporary: does a warm lambda keep serving the chain it minted?
 * mode=mint  -> resolve embed->sourcesUrl->manifest, stash a segment URL
 * mode=fetch -> fetch that stashed segment (a *separate* invocation)
 */
export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get('mode') ?? 'mint'
  const out: Record<string, unknown> = { mode, egressIp: await ip() }

  if (mode === 'mint') {
    const EMB = 'https://cdn.4animo.xyz/embed/hd-2/ani/113415/1/sub'
    const page = await fetch(EMB, {
      headers: { 'User-Agent': UA, Referer: 'https://zangetsu.cc/' },
      redirect: 'follow',
      cache: 'no-store',
    })
    const html = await page.text()
    const final = page.url
    const m = html.match(/sourcesUrl\s*=\s*'([^']+)'/)
    if (!m) return NextResponse.json({ ...out, error: 'no sourcesUrl' })
    const su = new URL(m[1], final).toString()
    const man = await fetch(su, {
      headers: { 'User-Agent': UA, Referer: final, Accept: 'application/json, text/plain, */*' },
      cache: 'no-store',
    })
    const j = (await man.json()) as { sources?: { file?: string }[] }
    const file = j.sources?.[0]?.file
    if (!file) return NextResponse.json({ ...out, error: 'no file' })
    const masterUrl = new URL(file, final).toString()
    const mt = await (await fetch(masterUrl, { headers: { 'User-Agent': UA, Referer: final } })).text()
    const child = mt
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'))
    if (!child) return NextResponse.json({ ...out, error: 'no child' })
    const childUrl = new URL(child, masterUrl).toString()
    const ct = await (await fetch(childUrl, { headers: { 'User-Agent': UA, Referer: final } })).text()
    const seg = ct
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'))
    if (!seg) return NextResponse.json({ ...out, error: 'no seg' })
    store.seg = new URL(seg, childUrl).toString()
    store.ref = final
    store.ip = out.egressIp as string
    out.mintedOn = store.ip
    out.segment = store.seg.slice(0, 60)
    return NextResponse.json(out)
  }

  // fetch mode: deliberately a separate invocation
  if (!store.seg) return NextResponse.json({ ...out, error: 'nothing minted on this instance' })
  const res = await fetch(store.seg, {
    headers: { 'User-Agent': UA, Referer: store.ref ?? '' },
    cache: 'no-store',
  })
  const buf = new Uint8Array(await res.arrayBuffer())
  out.mintedOn = store.ip
  out.sameInstance = store.ip === out.egressIp
  out.segmentStatus = res.status
  out.segmentBytes = buf.length
  return NextResponse.json(out)
}
