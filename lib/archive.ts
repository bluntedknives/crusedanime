/**
 * Internet Archive — the playable movie source.
 *
 * Every public Consumet mirror is dead (they time out) and the app's primary
 * provider (`zangetsu`) is anime-only, so films need a provider of their own.
 * The Archive is the honest choice: it is keyless, it serves its media with
 * permissive CORS, and its `feature_films` collection is genuinely
 * public-domain, so playback is both working and above board.
 *
 * Match quality is deliberately strict — the Archive's search ranks loosely and
 * will hand back an unrelated film for a near-miss query. A title only resolves
 * when its normalised form lines up with the query; otherwise playback reports
 * "unavailable" rather than silently playing the wrong film.
 */

const SEARCH = 'https://archive.org/advancedsearch.php'
const METADATA = 'https://archive.org/metadata'

/** Collections restricted to material that is actually free to view. */
const COLLECTIONS = ['feature_films', 'moviesandfilms', 'classic_cartoons', 'animationandcartoons']

const TTL_MS = 30 * 60 * 1000
const cache = new Map<string, { at: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

async function cached<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>
  const p = run()
  inflight.set(key, p)
  try {
    const value = await p
    cache.set(key, { at: Date.now(), value })
    return value
  } finally {
    inflight.delete(key)
  }
}

export interface ArchiveItem {
  id: string
  title: string
  year?: string
  description?: string
}

export interface ArchiveSource {
  url: string
  /** `mp4` plays natively; `m3u8` needs the HLS path in the client. */
  kind: 'mp4' | 'm3u8'
  label: string
  bytes?: number
}

/** Compare titles ignoring punctuation, case, leading articles and year tags. */
function simplify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Words that mark an item as an extra rather than the feature itself.
 *
 * The Archive's `feature_films` collection is not only features: it holds
 * trailers, clips, reviews and behind-the-scenes reels, and their titles are
 * often just the film's name with one of these appended. Without this check
 * "Backrooms" resolved to `backrooms-trailer` and the app played a two-minute
 * trailer as if it were the film.
 */
const EXTRA_WORDS =
  /\b(trailer|trailers|teaser|clip|clips|preview|promo|spot|spots|featurette|excerpt|sample|interview|review|behind the scenes|making of|deleted scene|bloopers|highlights|opening credits|end credits)\b/

function looksLikeExtra(title: string): boolean {
  return EXTRA_WORDS.test(simplify(title))
}

export function titlesMatch(candidate: string, query: string): boolean {
  // An extra is never the title being asked for, however well the words line up.
  if (looksLikeExtra(candidate)) return false
  return isCloseMatch(candidate, query)
}

function isCloseMatch(candidate: string, query: string): boolean {
  const c = simplify(candidate)
  const q = simplify(query)
  if (!c || !q) return false
  if (c === q) return true
  // Containment either way, but only when the shorter side is substantial —
  // otherwise "hope" would match "city of hope and despair".
  const [short, long] = c.length <= q.length ? [c, q] : [q, c]
  return short.length >= 4 && long.includes(short)
}

export async function search(query: string, limit = 5): Promise<ArchiveItem[]> {
  if (!query.trim()) return []
  const key = `s:${query}:${limit}`
  return cached(key, async () => {
    const clauses = COLLECTIONS.map((c) => `collection:${c}`).join(' OR ')
    const q = `(${clauses}) AND mediatype:movies AND (${query})`
    const params = new URLSearchParams({
      q,
      rows: String(limit * 3),
      output: 'json',
      sort: 'downloads desc',
    })
    for (const f of ['identifier', 'title', 'year']) params.append('fl[]', f)

    const res = await fetch(`${SEARCH}?${params}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`archive search -> ${res.status}`)
    const json = (await res.json()) as {
      response?: { docs?: { identifier: string; title?: string; year?: string }[] }
    }
    const docs = json.response?.docs ?? []
    return docs
      .filter((d) => d.title && isCloseMatch(d.title, query) && !looksLikeExtra(d.title))
      .slice(0, limit)
      .map((d) => ({ id: d.identifier, title: d.title as string, year: d.year }))
  })
}

/**
 * Resolve a playable file for an identifier.
 *
 * Prefers H.264 MP4, which every browser plays without a shim; HLS is the
 * fallback because the player already speaks it. Files under a megabyte are
 * trailers and samples, so they are skipped.
 */
export async function resolve(identifier: string): Promise<ArchiveSource | null> {
  const key = `r:${identifier}`
  return cached(key, async () => {
    const res = await fetch(`${METADATA}/${identifier}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      server?: string
      dir?: string
      files?: { name: string; format?: string; size?: string; length?: string }[]
    }
    const server = json.server
    const dir = json.dir
    if (!server || !dir) return null

    /**
     * A feature is minutes long, not seconds. `length` is seconds when the
     * Archive supplies it, and it is the only reliable signal for "is this the
     * actual film" — a trailer passes a size check easily, since a two-minute
     * clip is still several megabytes.
     */
    const isFeatureLength = (f: { length?: string; size?: string }) => {
      const secs = Number(f.length)
      if (Number.isFinite(secs) && secs > 0) return secs >= 20 * 60
      // No duration recorded: fall back to size, where a feature is far larger
      // than any trailer or sample.
      return Number(f.size ?? 0) >= 40_000_000
    }

    const video = (json.files ?? []).filter((f) => {
      const size = Number(f.size ?? 0)
      return size > 1_000_000 && /\.(mp4|m3u8|ogv|webm)$/i.test(f.name)
    })
    if (!video.length) return null

    // Only accept a source that is plausibly the whole film.
    const features = video.filter(isFeatureLength)
    if (!features.length) return null

    const rank = (f: { name: string; format?: string }) => {
      const n = f.name.toLowerCase()
      if (n.endsWith('.m3u8')) return 1
      if (n.endsWith('.mp4')) return 0
      return 2
    }
    features.sort((a, b) => rank(a) - rank(b))
    const pick = features[0]

    return {
      url: `https://${server}${dir}/${encodeURIComponent(pick.name)}`,
      kind: pick.name.toLowerCase().endsWith('.m3u8') ? 'm3u8' : 'mp4',
      label: pick.format ?? 'Video',
      bytes: Number(pick.size ?? 0) || undefined,
    }
  })
}

/**
 * Public-domain feature films, newest-uploaded first. Used to build a shelf of
 * titles that are known to be playable, rather than a shelf of popular titles
 * that mostly are not.
 */
export async function browse(limit = 18): Promise<ArchiveItem[]> {
  const key = `b:${limit}`
  return cached(key, async () => {
    const params = new URLSearchParams({
      q: 'collection:feature_films AND mediatype:movies',
      rows: String(limit * 2),
      output: 'json',
      sort: 'downloads desc',
    })
    for (const f of ['identifier', 'title', 'year', 'description']) params.append('fl[]', f)
    const res = await fetch(`${SEARCH}?${params}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`archive browse -> ${res.status}`)
    const json = (await res.json()) as {
      response?: { docs?: { identifier: string; title?: string; year?: string; description?: string }[] }
    }
    return (json.response?.docs ?? [])
      .filter((d) => d.title)
      .slice(0, limit)
      .map((d) => ({
        id: d.identifier,
        title: d.title as string,
        year: d.year,
        description: typeof d.description === 'string' ? d.description : undefined,
      }))
  })
}

/**
 * Find a playable source for a film by title. Returns null when nothing close
 * enough exists — the caller surfaces that as "unavailable", never as a guess.
 */
export async function sourceFor(title: string, year?: string | null): Promise<
  { item: ArchiveItem; source: ArchiveSource } | null
> {
  const candidates = await search(title, 5)
  if (!candidates.length) return null

  // Prefer a candidate whose year matches, when the caller knows one.
  const ordered = [...candidates].sort((a, b) => {
    if (!year) return 0
    const am = a.year === year ? -1 : 0
    const bm = b.year === year ? -1 : 0
    return am - bm
  })

  for (const item of ordered) {
    const source = await resolve(item.id)
    if (source) return { item, source }
  }
  return null
}
