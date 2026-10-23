/**
 * Stream tunnel.
 *
 * The CDN signs every playlist and segment URL against the address that
 * requested it, so a URL only serves the caller that minted it. Two separate
 * serverless invocations therefore cannot cooperate: whichever one mints the
 * URL, the other gets a 400 when it tries to fetch.
 *
 * A single invocation *can* do both — verified: one lambda resolving the chain
 * and then fetching a 965 KB media segment gets 200 — and a warm lambda keeps
 * its address between requests. So instead of handing signed URLs to a separate
 * proxy route, each request re-derives the chain itself and fetches from the
 * same invocation.
 *
 * The browser never sees an upstream URL. It gets short tokens naming a
 * position in the chain (`n` = playlist, `n`+`j` = segment, `i` = subtitle),
 * and this module resolves that position on demand. Positions are assigned in
 * discovery order, which is deterministic, so a cold instance replaying the
 * chain lands on the same indices the warm one used.
 */

const Z_CDN = 'https://cdn.4animo.xyz'
const ZANGETSU = 'https://zangetsu.cc'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const CHAIN_TTL_MS = 10 * 60_000

export type StreamType = 'sub' | 'dub'

/** A position in a resolved chain. Deliberately opaque to the client. */
export interface TunnelToken {
  /** AniList id. */
  a: number
  /** Episode number. */
  e: number
  /** Sub or dub. */
  y: StreamType
  /** MAL id, when the provider needs it to build the embed path. */
  m?: number | null
  /** p=playlist, s=segment, t=subtitle track, u=verbatim url. */
  k: 'p' | 's' | 't' | 'u'
  /** Playlist index. */
  n?: number
  /** Segment index within playlist `n`. */
  j?: number
  /** Subtitle index. */
  i?: number
  /** Verbatim url, only for `k: 'u'`. */
  u?: string
}

export function encodeToken(t: TunnelToken): string {
  return Buffer.from(JSON.stringify(t), 'utf8').toString('base64url')
}

export function decodeToken(raw: string | null): TunnelToken | null {
  if (!raw) return null
  try {
    const t = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as TunnelToken
    if (typeof t.a !== 'number' || typeof t.e !== 'number') return null
    if (t.y !== 'sub' && t.y !== 'dub') return null
    if (!['p', 's', 't', 'u'].includes(t.k)) return null
    return t
  } catch {
    return null
  }
}

interface Chain {
  /** The player page, used as the Referer every upstream request must carry. */
  embed: string
  sources: { url: string; quality: string }[]
  subtitles: { url: string; label: string; lang: string; default: boolean }[]
  intro: { start: number; end: number } | null
  outro: { start: number; end: number } | null
  /** Every playlist URL discovered so far, in discovery order. */
  flat: string[]
  /** Playlist bodies by index. */
  text: Map<number, string>
  /** Segment URLs by playlist index. */
  segs: Map<number, string[]>
  /** How many leading entries of `flat` have been fetched. */
  loaded: number
  /** Serialises lazy loading so parallel segment requests do not race. */
  lock: Promise<void>
  expires: number
}

const chains = new Map<string, Chain>()
const inflight = new Map<string, Promise<Chain>>()

function chainKey(t: Pick<TunnelToken, 'a' | 'e' | 'y' | 'm'>): string {
  return `${t.a}:${t.e}:${t.y}:${t.m ?? ''}`
}

/** Resolve a possibly-relative url against a base that may itself have a path. */
function absolutise(url: string, base: string): string {
  if (/^https?:\/\//i.test(url)) return url
  try {
    return new URL(url, base).toString()
  } catch {
    return url
  }
}

function normaliseMark(
  mark: { start?: number; end?: number } | null | undefined,
): { start: number; end: number } | null {
  if (!mark) return null
  const { start, end } = mark
  if (typeof start !== 'number' || typeof end !== 'number') return null
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return { start, end }
}

/** Upstream fetch carrying the headers the provider expects. */
async function upstream(
  url: string,
  referer: string,
  extra: Record<string, string> = {},
): Promise<Response> {
  let origin = Z_CDN
  try {
    origin = new URL(referer).origin
  } catch {
    /* keep the fallback origin */
  }
  return fetch(url, {
    headers: {
      'User-Agent': UA,
      Referer: referer,
      Origin: origin,
      Accept: '*/*',
      ...extra,
    },
    redirect: 'follow',
    cache: 'no-store',
  })
}

/** Bare (non-comment) URIs of a playlist, resolved against its own url. */
function childUris(text: string, base: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => absolutise(l, base))
}

/**
 * Resolve the player page for an episode into signed manifest urls.
 *
 * The embed path is constructible from the AniList id and episode number, so
 * this skips the much slower site scrape and its 40 s worst case.
 */
async function buildChain(t: Pick<TunnelToken, 'a' | 'e' | 'y' | 'm'>): Promise<Chain> {
  // The embed path carries the episode number: /embed/<server>/ani/<id>/<ep>/<type>.
  const candidates = [`${Z_CDN}/embed/hd-2/ani/${t.a}/${t.e}/${t.y}`]
  if (t.m) candidates.push(`${Z_CDN}/embed/hd-2/mal/${t.m}/${t.e}/${t.y}`)

  const errors: string[] = []
  for (const embedUrl of candidates) {
    try {
      const page = await upstream(embedUrl, `${ZANGETSU}/`)
      if (!page.ok) throw new Error(`embed ${page.status}`)
      const html = await page.text()
      // The CDN 301s to its media host; that origin is what the Referer and
      // every relative url must be based on.
      const embed = page.url || embedUrl

      const m = html.match(/sourcesUrl\s*=\s*'([^']+)'/)
      if (!m) throw new Error('embed exposed no manifest url')

      const man = await upstream(absolutise(m[1], embed), embed, {
        Accept: 'application/json, text/plain, */*',
      })
      if (!man.ok) throw new Error(`sources ${man.status}`)

      const j = (await man.json()) as {
        sources?: { file?: string; quality?: string | null; label?: string | null }[]
        tracks?: { file?: string; label?: string | null; kind?: string | null; default?: boolean }[]
        intro?: { start?: number; end?: number } | null
        outro?: { start?: number; end?: number } | null
      }

      const sources = (j.sources ?? [])
        .filter((s) => s.file)
        .map((s, i) => ({
          url: absolutise(s.file as string, embed),
          quality: s.quality || s.label || (i === 0 ? 'auto' : `source-${i + 1}`),
        }))
      if (!sources.length) throw new Error('manifest had no sources')

      const subtitles = (j.tracks ?? [])
        .filter((x) => x.file && (!x.kind || x.kind === 'captions' || x.kind === 'subtitles'))
        .map((x) => ({
          url: absolutise(x.file as string, embed),
          label: x.label || 'Unknown',
          lang: (x.label || 'Unknown').split(/[([]/)[0].trim(),
          default: Boolean(x.default),
        }))

      return {
        embed,
        sources,
        subtitles,
        intro: normaliseMark(j.intro),
        outro: normaliseMark(j.outro),
        flat: [sources[0].url],
        text: new Map(),
        segs: new Map(),
        loaded: 0,
        lock: Promise.resolve(),
        expires: Date.now() + CHAIN_TTL_MS,
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  throw new Error(`stream chain failed: ${errors.join(' | ')}`)
}

export async function getChain(
  t: Pick<TunnelToken, 'a' | 'e' | 'y' | 'm'>,
): Promise<Chain> {
  const key = chainKey(t)
  const hit = chains.get(key)
  if (hit && hit.expires > Date.now()) return hit

  const running = inflight.get(key)
  if (running) return running

  const run = buildChain(t)
    .then((chain) => {
      chains.set(key, chain)
      return chain
    })
    .finally(() => inflight.delete(key))

  inflight.set(key, run)
  return run
}

/** Fetch playlist `m` and record whether its children are playlists or media. */
async function loadPlaylist(chain: Chain, m: number): Promise<void> {
  const url = chain.flat[m]
  const res = await upstream(url, chain.embed)
  if (!res.ok) throw new Error(`playlist ${m} -> ${res.status}`)
  const text = await res.text()
  chain.text.set(m, text)

  const children = childUris(text, url)
  if (/#EXT-X-STREAM-INF/i.test(text)) {
    // A master playlist: children are further playlists, appended in order so
    // their indices stay stable across instances.
    for (const c of children) chain.flat.push(c)
  } else {
    chain.segs.set(m, children)
  }
}

/** Load every playlist up to and including index `n`. */
export async function ensurePlaylist(chain: Chain, n: number): Promise<void> {
  chain.lock = chain.lock.then(async () => {
    while (chain.loaded <= n && chain.loaded < chain.flat.length) {
      await loadPlaylist(chain, chain.loaded)
      chain.loaded += 1
    }
  })
  return chain.lock
}

/**
 * Point every child of a playlist back at this route.
 *
 * Playlist children become `k: 'p'` at their known index; media children become
 * `k: 's'`. Anything unrecognised falls back to a verbatim url, which still
 * works whenever the request lands on the instance that minted it.
 */
export function rewritePlaylist(
  text: string,
  base: string,
  chain: Chain,
  n: number,
  origin: string,
  t: Pick<TunnelToken, 'a' | 'e' | 'y' | 'm'>,
): string {
  const link = (tok: TunnelToken) => `${origin}/api/hls?t=${encodeToken(tok)}`

  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line

      if (trimmed.startsWith('#')) {
        // EXT-X-KEY / EXT-X-MAP / EXT-X-I-FRAME-STREAM-INF carry a URI.
        return line.replace(/URI="([^"]+)"/g, (_, uri: string) => {
          const abs = absolutise(uri, base)
          const idx = chain.flat.indexOf(abs)
          if (idx >= 0) return `URI="${link({ ...t, k: 'p', n: idx })}"`
          return `URI="${link({ ...t, k: 'u', u: abs })}"`
        })
      }

      const abs = absolutise(trimmed, base)
      const playlistIdx = chain.flat.indexOf(abs)
      if (playlistIdx >= 0) return link({ ...t, k: 'p', n: playlistIdx })

      const segIdx = (chain.segs.get(n) ?? []).indexOf(abs)
      if (segIdx >= 0) return link({ ...t, k: 's', n, j: segIdx })

      return link({ ...t, k: 'u', u: abs })
    })
    .join('\n')
}

export interface TunnelSummary {
  sources: { url: string; quality: string; isM3U8: boolean }[]
  subtitles: { url: string; label: string; lang: string; default?: boolean }[]
  embedUrl: string
  intro: { start: number; end: number } | null
  outro: { start: number; end: number } | null
  provider: string
}

/**
 * Public view of a chain: tokenised urls the browser can actually use, plus the
 * player page as a last-resort fallback.
 */
export async function tunnelFor(input: {
  anilistId: number
  malId?: number | null
  episode: number
  type: StreamType
  origin: string
}): Promise<TunnelSummary> {
  const t = {
    a: input.anilistId,
    e: input.episode,
    y: input.type,
    m: input.malId ?? null,
  }
  const chain = await getChain(t)
  const link = (tok: TunnelToken) => `${input.origin}/api/hls?t=${encodeToken(tok)}`

  return {
    sources: chain.sources.map((s) => ({
      url: link({ ...t, k: 'p', n: 0 }),
      quality: s.quality,
      isM3U8: true,
    })),
    subtitles: chain.subtitles.map((s, i) => ({
      url: link({ ...t, k: 't', i }),
      label: s.label,
      lang: s.lang,
      default: s.default,
    })),
    embedUrl: chain.embed,
    intro: chain.intro,
    outro: chain.outro,
    provider: 'zangetsu:s-3',
  }
}

/** Fetch the raw bytes for a segment token, preserving range semantics. */
export async function fetchSegment(
  chain: Chain,
  n: number,
  j: number,
  range: string | null,
): Promise<Response> {
  await ensurePlaylist(chain, n)
  const url = chain.segs.get(n)?.[j]
  if (!url) throw new Error(`segment ${n}/${j} is not in the playlist`)
  return upstream(url, chain.embed, range ? { Range: range } : {})
}

export async function fetchSubtitle(chain: Chain, i: number): Promise<Response> {
  const track = chain.subtitles[i]
  if (!track) throw new Error(`subtitle ${i} is not in the manifest`)
  return upstream(track.url, chain.embed)
}
