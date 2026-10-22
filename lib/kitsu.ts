import type {
  AiringScheduleEntry,
  CoverImage,
  Media,
  MediaFormat,
  MediaSeason,
  MediaStatus,
  Title,
  Trailer,
} from './anilist'

/**
 * Kitsu (kitsu.io/api/edge) read client.
 *
 * AniList is the primary metadata provider, but it periodically takes its
 * GraphQL endpoint fully offline ("temporarily disabled due to severe
 * stability issues"), which is a 403 for every query. Kitsu is an independent
 * service with real editorial data — canonical titles, synopses, episode
 * counts, category genres, poster/cover art and a curated YouTube trailer id —
 * so it backs AniList without the UI having to fall back to invented content.
 *
 * Ids: AniList ids are the app's public ids. Kitsu has no AniList mapping
 * (only MAL), so `ANILIST_TO_KITSU` pins the well-known titles and everything
 * else is addressed by its Kitsu id under the `k-<id>` namespace. Entries
 * created here keep their AniList id when one is known.
 */

const ENDPOINT = 'https://kitsu.io/api/edge'

/** Kitsu returns 403 without a conventional UA. */
const UA =
  'Mozilla/5.0 (compatible; crused.wtf/1.0)'

const TIMEOUT_MS = 9000

/* ----------------------------------------------------------------- ids ---- */

/** AniList id -> Kitsu id, for the titles most likely to be linked directly. */
const ANILIST_TO_KITSU: Record<number, number> = {
  101922: 41370, // Demon Slayer
  16498: 7442, // Attack on Titan
  1535: 1376, // Death Note
  21: 12, // One Piece
  11061: 6448, // Hunter x Hunter (2011)
  5114: 3936, // Fullmetal Alchemist: Brotherhood
  9253: 5646, // Steins;Gate
  30276: 10740, // One-Punch Man
  20605: 8271, // Tokyo Ghoul
  10620: 6266, // Mirai Nikki
  11757: 6589, // Sword Art Online
  108465: 42323, // Mushoku Tensei
  21519: 11614, // Kimi no Na wa.
  21459: 11469, // Boku no Hero Academia
  100166: 41084, // Vinland Saga
  127230: 43806, // Chainsaw Man
  97940: 13273, // Made in Abyss
  21087: 11578, // Mob Psycho 100
}

const KITSU_TO_ANILIST: Record<number, number> = Object.fromEntries(
  Object.entries(ANILIST_TO_KITSU).map(([a, k]) => [k, Number(a)]),
)

/** AniList ids whose Kitsu equivalent is unknown; renders as a Kitsu id. */
export const KITSU_ID_PREFIX = 'k-'

export function isKitsuId(id: string | number): boolean {
  return String(id).startsWith(KITSU_ID_PREFIX)
}

export function parseKitsuId(id: string | number): number | null {
  const n = Number(String(id).slice(KITSU_ID_PREFIX.length))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The id under which a Kitsu record is exposed, preferring its AniList id. */
function publicId(kitsuId: number): number {
  return KITSU_TO_ANILIST[kitsuId] ?? kitsuId
}

function kitsuIdFor(id: number): number | null {
  if (ANILIST_TO_KITSU[id]) return ANILIST_TO_KITSU[id]
  // A small numeric id may already *be* a Kitsu id.
  return null
}

/* ------------------------------------------------------------ transport -- */

export class KitsuError extends Error {}

/**
 * TTL cache plus request coalescing.
 *
 * Kitsu was previously fetched with `cache: 'no-store'` on every call, so each
 * home or schedule render re-fetched everything from scratch — the schedule
 * alone probes dozens of shows, which is where the multi-second page loads came
 * from. Titles and episode lists barely change, so a short TTL is safe, and
 * coalescing stops concurrent renders from issuing duplicate requests.
 */
const KITSU_TTL_MS = 10 * 60 * 1000
const KITSU_MAX_ENTRIES = 500

interface KitsuCacheEntry {
  at: number
  value: unknown
}

const kitsuCache = new Map<string, KitsuCacheEntry>()
const kitsuInflight = new Map<string, Promise<unknown>>()

function kitsuCacheGet<T>(key: string): T | null {
  const hit = kitsuCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > KITSU_TTL_MS) {
    kitsuCache.delete(key)
    return null
  }
  return hit.value as T
}

function kitsuCacheSet(key: string, value: unknown): void {
  if (kitsuCache.size >= KITSU_MAX_ENTRIES) {
    // Drop the oldest insertion; Map preserves insertion order.
    const oldest = kitsuCache.keys().next().value
    if (oldest !== undefined) kitsuCache.delete(oldest)
  }
  kitsuCache.set(key, { at: Date.now(), value })
}

async function api<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(ENDPOINT + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const key = url.toString()
  const cached = kitsuCacheGet<T>(key)
  if (cached !== null) return cached

  const pending = kitsuInflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const run = async (): Promise<T> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/vnd.api+json', 'User-Agent': UA },
        signal: ctrl.signal,
        next: { revalidate: 600 },
      })
      if (!res.ok) throw new KitsuError(`kitsu ${res.status} ${path}`)
      const json = (await res.json()) as T
      kitsuCacheSet(key, json)
      return json
    } catch (e) {
      if (e instanceof KitsuError) throw e
      throw new KitsuError(e instanceof Error ? e.message : 'kitsu request failed')
    } finally {
      clearTimeout(timer)
      kitsuInflight.delete(key)
    }
  }

  const promise = run()
  kitsuInflight.set(key, promise)
  return promise
}

/* -------------------------------------------------------------- mapping -- */

interface KitsuAttrs {
  slug?: string | null
  canonicalTitle?: string | null
  titles?: Record<string, string | null> | null
  synopsis?: string | null
  averageRating?: string | null
  episodeCount?: number | null
  episodeLength?: number | null
  subtype?: string | null
  status?: string | null
  startDate?: string | null
  endDate?: string | null
  youtubeVideoId?: string | null
  coverImage?: Record<string, string | null> | null
  posterImage?: Record<string, string | null> | null
  popularityRank?: number | null
  ratingRank?: number | null
  ageRating?: string | null
}

interface KitsuResource {
  id: string
  type: string
  attributes: KitsuAttrs
  relationships?: Record<string, { data: unknown }>
}

interface KitsuDoc {
  data: KitsuResource | KitsuResource[] | null
  included?: KitsuResource[]
  links?: { first?: string; next?: string; last?: string }
  meta?: { count?: number }
}

function pickImage(
  img: Record<string, string | null> | null | undefined,
  key: string,
): string | null {
  if (!img) return null
  return img[key] ?? img.large ?? img.original ?? img.medium ?? null
}

function imageSet(
  img: Record<string, string | null> | null | undefined,
): CoverImage {
  return {
    large: pickImage(img, 'large'),
    medium: pickImage(img, 'medium'),
    extraLarge: pickImage(img, 'original'),
    color: null,
  }
}

function seasonOf(startDate: string | null | undefined): MediaSeason | null {
  if (!startDate) return null
  const m = Number(startDate.slice(5, 7))
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  if (m <= 3) return 'WINTER'
  if (m <= 6) return 'SPRING'
  if (m <= 9) return 'SUMMER'
  return 'FALL'
}

function formatOf(subtype: string | null | undefined): MediaFormat | null {
  switch ((subtype ?? '').toLowerCase()) {
    case 'tv':
      return 'TV'
    case 'movie':
      return 'MOVIE'
    case 'special':
      return 'SPECIAL'
    case 'ova':
      return 'OVA'
    case 'ona':
      return 'ONA'
    case 'music':
      return 'MUSIC'
    default:
      return null
  }
}

function statusOf(status: string | null | undefined): MediaStatus | null {
  switch ((status ?? '').toLowerCase()) {
    case 'current':
      return 'RELEASING'
    case 'finished':
      return 'FINISHED'
    case 'tba':
      return 'NOT_YET_RELEASED'
    case 'unreleased':
      return 'NOT_YET_RELEASED'
    case 'upcoming':
      return 'NOT_YET_RELEASED'
    default:
      return null
  }
}

/** Kitsu score is 0-100 like AniList's, but comes back as a string. */
function scoreOf(v: string | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

function genresOf(doc: KitsuDoc, res: KitsuResource): string[] {
  const rel = res.relationships?.categories?.data
  if (!Array.isArray(rel) || !doc.included) return []
  const byId = new Map(
    doc.included.filter((i) => i.type === 'categories').map((i) => [i.id, i]),
  )
  return rel
    .map((r) => byId.get((r as { id: string }).id))
    .map((c) => (c?.attributes as { title?: string })?.title)
    .filter((t): t is string => Boolean(t))
}

function trailerOf(id: string | null | undefined): Trailer | null {
  // Kitsu hands back the bare video id, which is exactly AniList's shape.
  return id ? { id, site: 'youtube', thumbnail: null } : null
}

function toMedia(doc: KitsuDoc, res: KitsuResource): Media {
  const a = res.attributes
  const kitsuId = Number(res.id)
  const titles = a.titles ?? {}
  const canonical = a.canonicalTitle ?? titles.en ?? titles.en_jp ?? 'Untitled'

  const title: Title = {
    romaji: titles.en_jp ?? canonical,
    english: titles.en_us ?? titles.en ?? canonical,
    native: titles.ja_jp ?? null,
    userPreferred: canonical,
  }

  const startDate = a.startDate ?? null

  return {
    id: publicId(kitsuId),
    // Kitsu does not expose a MAL id on the anime resource itself.
    idMal: null,
    title,
    description: a.synopsis ?? null,
    coverImage: imageSet(a.posterImage),
    bannerImage: pickImage(a.coverImage, 'original') ?? pickImage(a.coverImage, 'large'),
    format: formatOf(a.subtype),
    status: statusOf(a.status),
    season: seasonOf(startDate),
    seasonYear: startDate ? Number(startDate.slice(0, 4)) || null : null,
    episodes: a.episodeCount ?? null,
    duration: a.episodeLength ?? null,
    chapters: null,
    volumes: null,
    countryOfOrigin: 'JP',
    source: null,
    hashtag: null,
    trailer: trailerOf(a.youtubeVideoId),
    averageScore: scoreOf(a.averageRating),
    meanScore: scoreOf(a.averageRating),
    popularity: a.popularityRank != null ? Math.max(0, 100000 - a.popularityRank) : null,
    favourites: null,
    genres: genresOf(doc, res),
    synonyms: a.slug ? [a.slug] : null,
    isAdult: (a.ageRating ?? '').toUpperCase().startsWith('R18'),
    startDate: startDate ? fuzzy(startDate) : null,
    endDate: a.endDate ? fuzzy(a.endDate) : null,
    nextAiringEpisode: null,
    studios: null,
    staff: null,
    characters: null,
    relations: null,
    recommendations: null,
    tags: null,
    externalLinks: a.slug
      ? [{ id: kitsuId, site: 'Kitsu', url: `https://kitsu.io/anime/${a.slug}`, type: null }]
      : null,
    streamingEpisodes: null,
    airingSchedule: null,
  }
}

function fuzzy(date: string) {
  return {
    year: Number(date.slice(0, 4)) || null,
    month: Number(date.slice(5, 7)) || null,
    day: Number(date.slice(8, 10)) || null,
  }
}

const LIST_INCLUDE = 'categories'

function listParams(limit: number, page = 1): Record<string, string> {
  return {
    'page[limit]': String(Math.min(Math.max(limit, 1), 20)),
    'page[offset]': String(Math.max(0, (page - 1) * limit)),
    include: LIST_INCLUDE,
  }
}

function asList(doc: KitsuDoc): Media[] {
  const arr = Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : []
  return arr.map((r) => toMedia(doc, r))
}

/* ------------------------------------------------------------------ api -- */

export async function trending(limit = 24): Promise<Media[]> {
  return asList(
    await api<KitsuDoc>('/anime', { sort: '-userCount', ...listParams(limit) }),
  )
}

export async function popular(limit = 24): Promise<Media[]> {
  return asList(
    await api<KitsuDoc>('/anime', { sort: '-userCount', ...listParams(limit) }),
  )
}

export async function topRated(limit = 24): Promise<Media[]> {
  return asList(
    await api<KitsuDoc>('/anime', {
      sort: '-averageRating',
      ...listParams(limit),
    }),
  )
}

export async function airingNow(limit = 24): Promise<Media[]> {
  return asList(
    await api<KitsuDoc>('/anime', {
      'filter[status]': 'current',
      sort: '-userCount',
      ...listParams(limit),
    }),
  )
}

export interface KitsuSearchOptions {
  year?: number | null
  season?: string | null
  format?: string | null
  status?: string | null
  scoreMin?: number | null
  genres?: string[]
}

/**
 * Search. Kitsu has no score/season filter, so those are applied client-side
 * over an over-fetched page. Genres are matched against the category titles
 * carried by the `include=categories` payload.
 */
export async function search(
  q: string,
  limit = 24,
  page = 1,
  opts: KitsuSearchOptions = {},
): Promise<Media[]> {
  const params: Record<string, string> = {
    'filter[text]': q,
    ...listParams(limit, page),
  }
  if (opts.year) params['filter[year]'] = String(opts.year)
  if (opts.format) params['filter[subtype]'] = opts.format.toLowerCase()
  if (opts.status) params['filter[status]'] = opts.status.toLowerCase()

  const rows = asList(await api<KitsuDoc>('/anime', params))

  const wantedGenres = (opts.genres ?? []).map((g) => g.toLowerCase())
  return rows.filter((m) => {
    if (opts.scoreMin && (m.averageScore ?? 0) < opts.scoreMin) return false
    if (opts.season) {
      const months: Record<string, [number, number]> = {
        WINTER: [1, 3],
        SPRING: [4, 6],
        SUMMER: [7, 9],
        FALL: [10, 12],
      }
      const range = months[opts.season.toUpperCase()]
      const month = m.startDate?.month
      if (range && month != null && (month < range[0] || month > range[1])) return false
    }
    if (wantedGenres.length > 0) {
      const have = (m.genres ?? []).map((g) => g.toLowerCase())
      if (!wantedGenres.some((g) => have.includes(g))) return false
    }
    return true
  })
}

/**
 * Resolve by id. `id` may be an AniList id (mapped via ANILIST_TO_KITSU) or a
 * raw Kitsu id. Anything unknown throws, so the data layer can move on to the
 * next provider rather than pretending some unrelated record was a match.
 */
export async function byId(id: number): Promise<Media | null> {
  const kitsuId = kitsuIdFor(id) ?? id
  const doc = await api<KitsuDoc>(`/anime/${kitsuId}`, { include: LIST_INCLUDE })
  const media = asList(doc)[0] ?? null
  // A number that is neither a known AniList id nor an existing Kitsu record
  // must not be reported as a hit.
  if (!media) throw new KitsuError(`no kitsu record for id ${id}`)
  return media
}

/** Kitsu category list, used to populate the search filter panel. */
export async function genres(): Promise<string[]> {
  const doc = await api<KitsuDoc>('/categories', {
    'page[limit]': '100',
    sort: 'title',
  })
  const arr = Array.isArray(doc.data) ? doc.data : []
  return arr
    .map((c) => (c.attributes as { title?: string })?.title)
    .filter((t): t is string => Boolean(t))
}

/* ------------------------------------------------------------ episodes --- */

export interface KitsuEpisode {
  number: number
  title: string | null
  synopsis: string | null
  thumbnail: string | null
  airdate: string | null
  length: number | null
}

/**
 * Real episode titles/thumbnails for a title, so the watch page lists what the
 * show actually has instead of bare numbers.
 */
export async function episodes(
  id: number,
  limit = 60,
  order: 'asc' | 'desc' = 'asc',
): Promise<KitsuEpisode[]> {
  const kitsuId = kitsuIdFor(id) ?? id
  const doc = await api<KitsuDoc>(`/anime/${kitsuId}/episodes`, {
    // Kitsu caps a page at 20. For a long-runner the episodes we care about are
    // the newest ones, so callers looking for what airs next ask for `desc`.
    'page[limit]': String(Math.min(limit, 20)),
    sort: order === 'desc' ? '-number' : 'number',
  })
  const arr = Array.isArray(doc.data) ? doc.data : []
  return arr.map((e) => {
    const a = e.attributes as unknown as {
      number?: number
      canonicalTitle?: string | null
      synopsis?: string | null
      thumbnail?: Record<string, string | null> | null
      airdate?: string | null
      length?: number | null
    }
    return {
      number: a.number ?? 0,
      title: a.canonicalTitle ?? null,
      synopsis: a.synopsis ?? null,
      thumbnail: pickImage(a.thumbnail, 'original'),
      airdate: a.airdate ?? null,
      length: a.length ?? null,
    }
  })
}

/* ---------------------------------------------------------- schedule ----- */

/** Map over items with a small concurrency cap. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

export interface KitsuScheduleOptions {
  /** How many currently-airing shows to inspect for upcoming episodes. */
  candidates?: number
  /** Window, in days from now. */
  days?: number
}

/**
 * Real upcoming episodes for the coming week.
 *
 * Kitsu has no schedule endpoint, but its per-episode `airdate` is genuine, so
 * a schedule can be assembled by checking currently-airing shows for episodes
 * due in the window. Dates carry no clock time, so entries are marked
 * `timeKnown: false` and the UI shows the day rather than a fake air time.
 */
export async function upcomingSchedule(
  opts: KitsuScheduleOptions = {},
): Promise<AiringScheduleEntry[]> {
  const candidates = opts.candidates ?? 60
  const days = opts.days ?? 7
  const nowMs = Date.now()
  const endMs = nowMs + days * 86_400_000

  const shows = await airingNow(candidates)

  const probes = await mapLimit(shows, 8, async (m) => {
    const kitsuId = kitsuIdFor(m.id) ?? m.id
    try {
      return { m, eps: await episodes(kitsuId, 20, 'desc') }
    } catch {
      return { m, eps: [] as KitsuEpisode[] }
    }
  })

  const entries: AiringScheduleEntry[] = []
  for (const { m, eps } of probes) {
    for (const ep of eps) {
      if (!ep.airdate) continue
      const t = Date.parse(ep.airdate)
      if (!Number.isFinite(t) || t < nowMs - 86_400_000 || t > endMs) continue
      entries.push({
        id: m.id,
        episode: ep.number,
        airingAt: Math.floor(t / 1000),
        timeUntilAiring: Math.max(0, Math.floor((t - nowMs) / 1000)),
        media: m,
        // A real date from a real episode airdate — but with no clock time.
        timeKnown: false,
        derived: false,
      })
    }
  }

  return entries.sort((a, b) => a.airingAt - b.airingAt)
}

/**
 * Derived view used only when no real airdates were found: currently-airing
 * titles laid out across the week. Episode counts are real; the times are not,
 * which is what `scheduleIsApproximate` and the schedule page's notice convey.
 */
export const scheduleIsApproximate = true

export async function derivedSchedule(limit = 20): Promise<AiringScheduleEntry[]> {
  const now = Math.floor(Date.now() / 1000)
  const shows = await airingNow(limit)
  if (shows.length === 0) return []

  const step = Math.floor((7 * 24 * 3600) / shows.length)
  return shows.map((m, i) => {
    const airingAt = now + 3600 + i * step
    return {
      id: m.id,
      episode: m.episodes ?? 1,
      airingAt,
      timeUntilAiring: Math.max(0, airingAt - now),
      media: m,
      timeKnown: false,
      // Nothing published this slot; the day is ours, not the provider's.
      derived: true,
    }
  })
}
