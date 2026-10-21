/**
 * Stream resolution.
 *
 * Primary provider scrapes a hianime-style site (search -> watch token ->
 * episodes -> servers -> signed source manifest). Secondary providers are
 * Consumet-compatible REST instances that expose the same `{sources,tracks}`
 * shape. Every provider is normalised into the `StreamPayload` below, and
 * resolution walks the provider list until one returns a playable manifest.
 */

const ZANGETSU = 'https://zangetsu.cc'
const Z_CDN = 'https://cdn.4animo.xyz'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/** Consumet-compatible mirrors, tried in order after the primary provider. */
export const CONSUMET_INSTANCES = [
  'https://consumet-api-phi.vercel.app',
  'https://consumet-api-zeta.vercel.app',
  'https://api.consumet.org',
]

/* ------------------------------------------------------------------ types */

export interface StreamSource {
  url: string
  quality: string
  isM3U8: boolean
}

export interface StreamSubtitle {
  url: string
  lang: string
  label: string
  default?: boolean
}

export interface StreamPayload {
  sources: StreamSource[]
  subtitles: StreamSubtitle[]
  /** Headers the browser needs when fetching the manifest/segments. */
  headers: Record<string, string>
  provider: string
  intro?: { start: number; end: number } | null
  outro?: { start: number; end: number } | null
}

export interface EpisodeInfo {
  number: number
  id: string
  title: string | null
  image: string | null
  description: string | null
  filler: boolean
  hasSub: boolean
  hasDub: boolean
  /**
   * Season this episode belongs to. Only the film/series catalogue populates
   * it; external embed providers are season-addressed, so it must survive the
   * trip from Cinemeta to the player.
   */
  season?: number | null
  /** Provider-native ids used to address this episode later. */
  ani?: string | null
  mal?: string | null
  embedId?: string | null
}

export interface ResolvedAnime {
  provider: string
  providerAnimeId: string
  slug: string
  title: string
  episodes: EpisodeInfo[]
}

export class StreamError extends Error {
  constructor(
    message: string,
    readonly provider?: string,
  ) {
    super(message)
    this.name = 'StreamError'
  }
}

/* ---------------------------------------------------------------- helpers */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
}

function normaliseTitle(t: string): string {
  return decodeEntities(t)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(season|part|cour|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Token-overlap score, tolerant of season suffixes and punctuation drift. */
function similarity(a: string, b: string): number {
  const ta = new Set(normaliseTitle(a).split(' ').filter(Boolean))
  const tb = new Set(normaliseTitle(b).split(' ').filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.max(ta.size, tb.size)
}

/**
 * Wall-clock budget for a whole resolution attempt. Provider retries multiply
 * (title variants x search attempts x servers), so without a shared deadline a
 * single slow host can hold the request open for minutes.
 */
const RESOLVE_BUDGET_MS = 95_000

/** Milliseconds left in the budget, or Infinity when unbounded. */
function remainingMs(deadline?: number): number {
  if (!deadline) return Number.POSITIVE_INFINITY
  return deadline - Date.now()
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeout?: number; deadline?: number } = {},
): Promise<Response> {
  const { timeout = 15_000, deadline, ...rest } = init

  // Never let one request outlive the overall budget.
  const budget = remainingMs(deadline)
  if (budget <= 0) throw new StreamError('request budget exhausted', 'zangetsu')
  const effective = Math.min(timeout, budget)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), effective)
  try {
    return await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'User-Agent': UA, ...(rest.headers as Record<string, string>) },
    })
  } finally {
    clearTimeout(timer)
  }
}

/* --------------------------------------------------------------- caching */

interface CacheEntry<T> {
  value: T
  expires: number
}
const cache = new Map<string, CacheEntry<unknown>>()
const pending = new Map<string, Promise<unknown>>()

function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T)

  const inflight = pending.get(key) as Promise<T> | undefined
  if (inflight) return inflight

  const run = fn()
    .then((value) => {
      cache.set(key, { value, expires: Date.now() + ttl })
      return value
    })
    .finally(() => pending.delete(key))

  pending.set(key, run)
  return run
}

export function clearStreamCache() {
  cache.clear()
}

/* --------------------------------------------- provider: hianime-style site */

interface ZSearchHit {
  id: number
  slug: string
  title: string
  alternativeTitle?: string | null
  type?: string | null
  year?: number | null
  poster?: string | null
  duration?: string | null
}

/**
 * Search is throttled: rapid sequential calls can return a 200 with no
 * `response` array. That soft failure must not be cached as "no results", so
 * we retry with backoff and only cache a non-empty result set.
 */
async function zSearch(term: string, deadline?: number): Promise<ZSearchHit[]> {
  const key = `z:search:${term.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as ZSearchHit[]

  const pendingHit = pending.get(key) as Promise<ZSearchHit[]> | undefined
  if (pendingHit) return pendingHit

  const run = (async () => {
    let lastErr: unknown
    // Upstream search routinely takes 20-40s, so retrying three times inside a
    // single 15s window would guarantee failure. One long attempt, then a
    // single short retry only if there is budget left.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (remainingMs(deadline) <= 0) break
      try {
        const res = await fetchWithTimeout(
          `${ZANGETSU}/ajax/search?keyword=${encodeURIComponent(term)}`,
          {
            deadline,
            timeout: 45_000,
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              Referer: `${ZANGETSU}/`,
              Accept: 'application/json, text/plain, */*',
            },
          },
        )
        if (!res.ok) throw new StreamError(`search failed (${res.status})`, 'zangetsu')

        const json = (await res.json()) as { success?: boolean; response?: ZSearchHit[] }
        if (!Array.isArray(json.response)) {
          throw new StreamError('search returned no result set (throttled)', 'zangetsu')
        }
        if (json.response.length) {
          cache.set(key, { value: json.response, expires: Date.now() + 10 * 60_000 })
        }
        return json.response
      } catch (err) {
        lastErr = err
        await sleep(500)
      }
    }
    throw lastErr instanceof Error ? lastErr : new StreamError('search failed', 'zangetsu')
  })().finally(() => pending.delete(key))

  pending.set(key, run)
  return run
}

/**
 * An AJAX token alone is not enough: the endpoints also validate the
 * `PHPSESSID` handed out by the watch page, and reject the request with a bare
 * 403 when it is missing. Both halves are captured together and reused.
 */
interface ZSession {
  token: string
  cookie: string
}

async function zSession(slug: string, deadline?: number): Promise<ZSession> {
  return cached(`z:session:${slug}`, 3 * 60_000, async () => {
    const res = await fetchWithTimeout(`${ZANGETSU}/watch/${slug}`, {
      deadline,
      timeout: 30_000,
      headers: { Referer: `${ZANGETSU}/` },
    })
    if (!res.ok) throw new StreamError(`watch page ${res.status}`, 'zangetsu')

    const html = await res.text()
    const m = html.match(/AJAX_TOKEN\s*=\s*"([^"]+)"/)
    if (!m) throw new StreamError('no ajax token on watch page', 'zangetsu')

    // `getSetCookie` is the reliable accessor when several cookies are set.
    const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    const fallback = res.headers.get('set-cookie')
    const cookies = (raw.length ? raw : fallback ? [fallback] : [])
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)

    return { token: m[1], cookie: cookies.join('; ') }
  })
}

async function zAjax<T>(
  path: string,
  slug: string,
  session: ZSession,
  deadline?: number,
): Promise<T> {
  const res = await fetchWithTimeout(`${ZANGETSU}${path}`, {
    deadline,
    timeout: 30_000,
    headers: {
      'X-Page-Token': session.token,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${ZANGETSU}/watch/${slug}`,
      Accept: 'application/json, text/plain, */*',
      ...(session.cookie ? { Cookie: session.cookie } : {}),
    },
  })
  if (!res.ok) throw new StreamError(`ajax ${path} -> ${res.status}`, 'zangetsu')
  return (await res.json()) as T
}

interface ZEpisode {
  id: string
  number: number
  titles?: { en?: string | null; romaji?: string | null; ja?: string | null } | null
  title?: string | null
  alternativeTitle?: string | null
  sub?: boolean
  dub?: boolean
  embed_id?: string | null
  ani?: string | null
  mal?: string | null
  filler?: boolean
}

/**
 * Resolve an AniList id (plus MAL id and title for matching) to a provider
 * anime and its episode list. Matching is verified against the per-episode
 * AniList/MAL ids the provider exposes, which makes title collisions safe.
 */
export async function resolveAnime(input: {
  anilistId: number
  malId?: number | null
  title: string
  altTitles?: string[]
  deadline?: number
}): Promise<ResolvedAnime> {
  const { anilistId, malId, title, altTitles = [], deadline } = input
  return cached(`z:resolve:${anilistId}`, 30 * 60_000, async () => {
    const candidates = [title, ...altTitles].filter(Boolean)
    const seen = new Map<number, ZSearchHit>()

    for (const term of candidates) {
      if (remainingMs(deadline) <= 0) break
      try {
        for (const hit of await zSearch(term, deadline)) seen.set(hit.id, hit)
      } catch {
        /* try the next title variant */
      }
      if (seen.size > 12) break
    }
    if (!seen.size) throw new StreamError(`no provider match for "${title}"`, 'zangetsu')

    const scored = [...seen.values()]
      .map((hit) => {
        const best = Math.max(
          similarity(hit.title, title),
          ...altTitles.map((a) => similarity(hit.title, a)),
          0,
        )
        return { hit, score: best }
      })
      .sort((a, b) => b.score - a.score)

    // Walk candidates in score order and accept the first whose episode ids
    // corroborate the requested AniList/MAL id.
    for (const { hit } of scored.slice(0, 4)) {
      if (remainingMs(deadline) <= 0) break
      try {
        const session = await zSession(hit.slug, deadline)
        const data = await zAjax<{ success?: boolean; episodes?: ZEpisode[] }>(
          `/ajax/episodes?animeId=${hit.id}`,
          hit.slug,
          session,
          deadline,
        )
        const eps = data.episodes ?? []
        if (!eps.length) continue

        const corroborated = eps.some((e) => {
          const ani = e.ani?.split('/')[0]
          const mal = e.mal?.split('/')[0]
          return (
            (ani && Number(ani) === anilistId) || (malId != null && mal && Number(mal) === malId)
          )
        })
        // Without an id match fall back to a strong title match so that
        // entries the provider has not linked yet still resolve.
        if (!corroborated && scored[0].score < 0.6) continue

        return {
          provider: 'zangetsu',
          providerAnimeId: String(hit.id),
          slug: hit.slug,
          title: hit.title,
          episodes: eps.map(
            (e): EpisodeInfo => ({
              number: e.number,
              id: String(e.id),
              title: e.titles?.en || e.title || e.titles?.romaji || null,
              image: null,
              description: null,
              filler: Boolean(e.filler),
              hasSub: e.sub !== false,
              hasDub: Boolean(e.dub),
              ani: e.ani ?? null,
              mal: e.mal ?? null,
              embedId: e.embed_id ?? null,
            }),
          ),
        }
      } catch {
        continue
      }
    }

    throw new StreamError(`could not verify a provider match for "${title}"`, 'zangetsu')
  })
}

interface ZServer {
  serverId: string
  serverName: string
  index?: number
}

/**
 * Server -> embed URL mapping. Names are opaque (`s-1`..`s-3`) so the mapping
 * lives here rather than being derived from the payload.
 */
function zEmbedUrl(serverName: string, ep: EpisodeInfo, type: 'sub' | 'dub'): string | null {
  const ani = ep.ani ?? null
  const mal = ep.mal ?? null
  const id = ep.id
  switch (serverName) {
    case 's-1':
      if (ani) return `https://flixera.co/embed/ani/${ani}/${type}`
      if (mal) return `https://flixera.co/embed/mal/${mal}/${type}`
      return `https://flixera.co/embed/ani/${id}/${type}`
    case 's-2':
      return `${Z_CDN}/embed/hd-1/${id}/${type}`
    case 's-3':
      if (ani) return `${Z_CDN}/embed/hd-2/ani/${ani}/${type}`
      if (mal) return `${Z_CDN}/embed/hd-2/mal/${mal}/${type}`
      return `${Z_CDN}/embed/hd-2/${id}/${type}`
    default:
      return null
  }
}

/** Ranked so the most reliable player is attempted first. */
const SERVER_RANK: Record<string, number> = { 's-3': 0, 's-2': 1, 's-1': 2 }

interface ZManifest {
  sources?: { file?: string; quality?: string | null; label?: string | null }[]
  tracks?: { file?: string; label?: string | null; kind?: string | null; default?: boolean }[]
  intro?: { start?: number; end?: number } | null
  outro?: { start?: number; end?: number } | null
}

/** Intro/outro markers arrive partially populated; only keep usable pairs. */
function normaliseMark(
  mark: { start?: number; end?: number } | null | undefined,
): { start: number; end: number } | null {
  if (!mark) return null
  const { start, end } = mark
  if (typeof start !== 'number' || typeof end !== 'number') return null
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return { start, end }
}

function absolutise(url: string, base: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return base.replace(/\/$/, '') + (url.startsWith('/') ? url : `/${url}`)
}

async function zSourcesForEpisode(
  ep: EpisodeInfo,
  type: 'sub' | 'dub',
  slug: string,
  session: ZSession,
  deadline?: number,
): Promise<StreamPayload> {
  const servers = await zAjax<Record<string, ZServer[]>>(
    `/ajax/server?episodeId=${encodeURIComponent(ep.id)}&sub=${type === 'sub'}&dub=${type === 'dub'}`,
    slug,
    session,
    deadline,
  )

  const list = (servers[type] ?? []).slice().sort((a, b) => {
    return (SERVER_RANK[a.serverName] ?? 9) - (SERVER_RANK[b.serverName] ?? 9)
  })
  if (!list.length) throw new StreamError(`no ${type} servers offered`, 'zangetsu')

  let lastErr: unknown
  for (const server of list) {
    if (remainingMs(deadline) <= 0) break
    const embed = zEmbedUrl(server.serverName, ep, type)
    if (!embed) continue
    const base = new URL(embed).origin

    try {
      const page = await fetchWithTimeout(embed, {
        deadline,
        headers: { Referer: `${ZANGETSU}/` },
        timeout: 20_000,
      })
      if (!page.ok) throw new StreamError(`embed ${page.status}`, 'zangetsu')

      const html = await page.text()
      const m = html.match(/sourcesUrl\s*=\s*'([^']+)'/)
      if (!m) throw new StreamError('embed exposed no manifest url', 'zangetsu')

      const manifestRes = await fetchWithTimeout(absolutise(m[1], base), {
        deadline,
        headers: { Referer: embed, Accept: 'application/json, text/plain, */*' },
        timeout: 20_000,
      })
      if (!manifestRes.ok) throw new StreamError(`manifest ${manifestRes.status}`, 'zangetsu')

      const manifest = (await manifestRes.json()) as ZManifest
      const sources: StreamSource[] = (manifest.sources ?? [])
        .filter((s) => s.file)
        .map((s, i) => ({
          url: absolutise(s.file as string, base),
          quality: s.quality || s.label || (i === 0 ? 'auto' : `source-${i + 1}`),
          isM3U8: /\.m3u8|\/p\?t=|mpegurl/i.test(s.file as string),
        }))
      if (!sources.length) throw new StreamError('manifest had no sources', 'zangetsu')

      const subtitles: StreamSubtitle[] = (manifest.tracks ?? [])
        .filter((t) => t.file && (!t.kind || t.kind === 'captions' || t.kind === 'subtitles'))
        .map((t) => ({
          url: absolutise(t.file as string, base),
          lang: (t.label || 'Unknown').split(/[([]/)[0].trim(),
          label: t.label || 'Unknown',
          default: Boolean(t.default),
        }))

      return {
        sources,
        subtitles,
        headers: {
          Referer: `${embed}`,
          Origin: base,
          'User-Agent': UA,
        },
        provider: `zangetsu:${server.serverName}`,
        intro: normaliseMark(manifest.intro),
        outro: normaliseMark(manifest.outro),
      }
    } catch (err) {
      lastErr = err
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new StreamError('every server failed for this episode', 'zangetsu')
}

/* ------------------------------------------------ provider: consumet mirrors */

async function consumetJson<T>(instance: string, path: string): Promise<T> {
  const res = await fetchWithTimeout(`${instance}${path}`, {
    headers: { Accept: 'application/json' },
    timeout: 12_000,
  })
  if (!res.ok) throw new StreamError(`${instance} ${path} -> ${res.status}`, instance)
  return (await res.json()) as T
}

async function consumetGogo(
  instance: string,
  title: string,
  episode: number,
  type: 'sub' | 'dub',
): Promise<StreamPayload> {
  const search = await consumetJson<{ results?: { id: string; title: string }[] }>(
    instance,
    `/anime/gogoanime/${encodeURIComponent(title)}`,
  )
  const results = search.results ?? []
  if (!results.length) throw new StreamError('no gogoanime results', instance)

  const best = results
    .map((r) => ({ r, s: similarity(r.title, title) }))
    .sort((a, b) => b.s - a.s)[0].r

  const info = await consumetJson<{ episodes?: { id: string; number: number }[] }>(
    instance,
    `/anime/gogoanime/info/${encodeURIComponent(best.id)}`,
  )
  const episodes = info.episodes ?? []
  const target = episodes.find((e) => e.number === episode) ?? episodes[episode - 1]
  if (!target) throw new StreamError(`episode ${episode} not found`, instance)

  const data = await consumetJson<{
    sources?: { url: string; quality?: string; isM3U8?: boolean }[]
    headers?: Record<string, string>
  }>(instance, `/anime/gogoanime/watch/${encodeURIComponent(target.id)}?server=gogocdn`)

  const sources = (data.sources ?? []).map((s, i) => ({
    url: s.url,
    quality: s.quality || (i === 0 ? 'auto' : `source-${i + 1}`),
    isM3U8: s.isM3U8 ?? /\.m3u8/i.test(s.url),
  }))
  if (!sources.length) throw new StreamError('gogoanime returned no sources', instance)

  void type
  return {
    sources,
    subtitles: [],
    headers: data.headers ?? { Referer: 'https://gogoanimehd.io/' },
    provider: `${instance.replace('https://', '')}:gogoanime`,
  }
}

/* ------------------------------------------------------------- public API */

export interface ResolveStreamInput {
  anilistId: number
  malId?: number | null
  title: string
  altTitles?: string[]
  episode: number
  type?: 'sub' | 'dub'
}

/**
 * Resolve a playable stream for one episode, walking providers until one
 * succeeds. Returns normalised `{sources, subtitles, headers}`.
 */
export async function resolveStream(input: ResolveStreamInput): Promise<StreamPayload> {
  const type = input.type ?? 'sub'
  const key = `stream:${input.anilistId}:${input.episode}:${type}`
  return cached(key, 15 * 60_000, async () => {
    const errors: string[] = []
    const deadline = Date.now() + RESOLVE_BUDGET_MS

    try {
      const resolved = await resolveAnime({ ...input, deadline })
      const ep =
        resolved.episodes.find((e) => e.number === input.episode) ??
        resolved.episodes[input.episode - 1]
      if (!ep) throw new StreamError(`episode ${input.episode} is not in the provider list`, 'zangetsu')

      const session = await zSession(resolved.slug, deadline)
      return await zSourcesForEpisode(ep, type, resolved.slug, session, deadline)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }

    for (const instance of CONSUMET_INSTANCES) {
      if (remainingMs(deadline) <= 0) break
      try {
        return await consumetGogo(instance, input.title, input.episode, type)
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err))
      }
      await sleep(150)
    }

    throw new StreamError(`all providers failed: ${errors.slice(0, 4).join(' | ')}`)
  })
}

/**
 * Episode lists fall back to AniList-derived placeholders, so waiting a long
 * time for the provider is worse than degrading. Kept short enough that the
 * watch page still paints during an upstream slow spell.
 */
const EPISODES_BUDGET_MS = 30_000

/** Episode list with provider metadata, used by the watch and detail pages. */
export async function getEpisodes(input: {
  anilistId: number
  malId?: number | null
  title: string
  altTitles?: string[]
  /** Fallback count from AniList when the provider has no list yet. */
  totalEpisodes?: number | null
}): Promise<EpisodeInfo[]> {
  const deadline = Date.now() + EPISODES_BUDGET_MS
  try {
    const resolved = await resolveAnime({ ...input, deadline })
    return resolved.episodes
  } catch {
    // Provider has no entry yet: synthesise a list from AniList metadata so
    // the UI still works for upcoming or unlicensed titles.
    const total = input.totalEpisodes ?? 0
    return Array.from({ length: total }, (_, i) => ({
      number: i + 1,
      id: `${input.anilistId}-${i + 1}`,
      title: null,
      image: null,
      description: null,
      filler: false,
      hasSub: true,
      hasDub: false,
    }))
  }
}

/** Lightweight health probe used by the settings/debug surface. */
export async function providerHealth() {
  const results: { provider: string; ok: boolean; detail: string }[] = []

  try {
    const hits = await zSearch('naruto')
    results.push({
      provider: 'zangetsu (primary)',
      ok: hits.length > 0,
      detail: `${hits.length} search hits`,
    })
  } catch (err) {
    results.push({
      provider: 'zangetsu (primary)',
      ok: false,
      detail: err instanceof Error ? err.message : 'failed',
    })
  }

  for (const instance of CONSUMET_INSTANCES) {
    try {
      const r = await consumetJson<{ results?: unknown[] }>(
        instance,
        '/anime/gogoanime/naruto',
      )
      results.push({
        provider: instance,
        ok: (r.results?.length ?? 0) > 0,
        detail: `${r.results?.length ?? 0} search hits`,
      })
    } catch (err) {
      results.push({
        provider: instance,
        ok: false,
        detail: err instanceof Error ? err.message : 'failed',
      })
    }
  }

  return results
}
