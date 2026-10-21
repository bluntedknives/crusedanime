const ENDPOINT = 'https://graphql.anilist.co'

/* ------------------------------------------------------------------ types */

export type MediaFormat =
  | 'TV'
  | 'TV_SHORT'
  | 'MOVIE'
  | 'SPECIAL'
  | 'OVA'
  | 'ONA'
  | 'MUSIC'
  | 'MANGA'
  | 'NOVEL'
  | 'ONE_SHOT'

export type MediaSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
export type MediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'

export interface FuzzyDate {
  year: number | null
  month: number | null
  day: number | null
}

export interface CoverImage {
  extraLarge: string | null
  large: string | null
  medium: string | null
  color: string | null
}

export interface Title {
  romaji: string | null
  english: string | null
  native: string | null
  userPreferred: string | null
}

export interface Trailer {
  id: string | null
  site: string | null
  thumbnail: string | null
}

export interface Tag {
  id: number
  name: string
  rank: number | null
  isMediaSpoiler: boolean | null
}

export interface Studio {
  id: number
  name: string
  isAnimationStudio: boolean | null
}

export interface MediaCharacter {
  id: number
  name: { full: string | null; native: string | null }
  image: { large: string | null; medium: string | null }
}

export interface MediaEdge {
  id: number
  relationType: string | null
  node: Media
}

export interface CharacterEdge {
  id: number
  role: string | null
  node: {
    id: number
    name: { full: string | null; native: string | null }
    image: { large: string | null; medium: string | null }
  }
  voiceActors?: { id: number; name: { full: string | null }; image: { large: string | null } }[]
}

export interface StaffEdge {
  role: string | null
  node: {
    id: number
    name: { full: string | null }
    image: { large: string | null }
  }
}

export interface AiringEpisode {
  id: number
  episode: number
  airingAt: number
  timeUntilAiring: number
}

export interface Media {
  id: number
  idMal: number | null
  title: Title
  description: string | null
  coverImage: CoverImage
  bannerImage: string | null
  format: MediaFormat | null
  status: MediaStatus | null
  season: MediaSeason | null
  seasonYear: number | null
  episodes: number | null
  duration: number | null
  chapters: number | null
  volumes: number | null
  countryOfOrigin: string | null
  source: string | null
  hashtag: string | null
  trailer: Trailer | null
  averageScore: number | null
  meanScore: number | null
  popularity: number | null
  favourites: number | null
  genres: string[] | null
  synonyms: string[] | null
  isAdult: boolean | null
  startDate: FuzzyDate | null
  endDate: FuzzyDate | null
  nextAiringEpisode: AiringEpisode | null
  studios?: { edges: { isMain: boolean | null; node: Studio }[] } | null
  staff?: { edges: StaffEdge[] } | null
  characters?: { edges: CharacterEdge[] } | null
  relations?: { edges: MediaEdge[] } | null
  recommendations?: { nodes: { id: number; rating: number | null; mediaRecommendation: Media | null }[] } | null
  tags?: Tag[] | null
  externalLinks?: { id: number; site: string; url: string; type: string | null }[] | null
  streamingEpisodes?: { title: string | null; thumbnail: string | null; url: string | null; site: string | null }[] | null
  airingSchedule?: { nodes: AiringEpisode[] } | null
}

export interface PageInfo {
  total: number
  currentPage: number
  lastPage: number
  hasNextPage: boolean
  perPage: number
}

export interface Page<T> {
  pageInfo: PageInfo
  media: T[]
}

export interface SearchFilters {
  q?: string
  genres?: string[]
  year?: number | null
  season?: MediaSeason | null
  format?: MediaFormat | null
  status?: MediaStatus | null
  scoreMin?: number | null
  studio?: string | null
  sort?: string[]
  page?: number
  perPage?: number
  isAdult?: boolean
}

/* ---------------------------------------------------------------- caching */

/** How long to stop calling AniList after it reports the API is disabled. */
const BREAKER_MS = 120_000
let breakerUntil = 0

interface CacheEntry<T> {
  value: T
  expires: number
}

const TTL = {
  short: 60_000,
  medium: 5 * 60_000,
  long: 30 * 60_000,
} as const

/**
 * Small in-memory LRU-ish cache keyed by the serialised request. Kept on the
 * module scope so it survives across requests within a server process but is
 * discarded on restart — good enough for public metadata that changes slowly.
 */
const store = new Map<string, CacheEntry<unknown>>()
const MAX_ENTRIES = 500
const inflight = new Map<string, Promise<unknown>>()

function cacheGet<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit) return null
  if (hit.expires < Date.now()) {
    store.delete(key)
    return null
  }
  // refresh recency
  store.delete(key)
  store.set(key, hit)
  return hit.value as T
}

/**
 * Read an entry past its TTL. Used as a last resort when the upstream is
 * unavailable: stale metadata is far better than an empty page, and AniList
 * has taken the API fully offline for stretches at a time.
 */
function cacheGetStale<T>(key: string): T | null {
  const hit = store.get(key)
  return hit ? (hit.value as T) : null
}

function cacheSet<T>(key: string, value: T, ttl: number): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(key, { value, expires: Date.now() + ttl })
}

export function clearCache(): void {
  store.clear()
}

export function cacheStats() {
  return { size: store.size, max: MAX_ENTRIES, inflight: inflight.size }
}

/* ----------------------------------------------------------------- client */

export class AniListError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AniListError'
  }
}

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string; status?: number; locations?: unknown }[]
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  opts: { ttl?: number; revalidate?: number } = {},
): Promise<T> {
  const ttl = opts.ttl ?? TTL.medium
  const key = `${query.length}:${JSON.stringify(variables)}`

  // Circuit breaker. AniList disables its API outright for minutes at a time
  // and answers every query with 403; retrying each request three times with
  // backoff just adds ~6s of dead latency to every page. Once we see that, stop
  // asking for a while and let the data layer go straight to the fallback.
  if (Date.now() < breakerUntil) {
    throw new AniListError('AniList circuit open (API disabled upstream)', 403)
  }

  const cached = cacheGet<T>(key)
  if (cached !== null) return cached

  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const run = (async (): Promise<T> => {
    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
          // AniList responses are small; rely on our own cache for hot paths.
          next: { revalidate: opts.revalidate ?? 0 },
        })

        if (res.status === 403) {
          // AniList returns 403 when it has disabled the API for stability
          // reasons. That is global and lasts minutes, so retrying is pointless:
          // trip the breaker and fail fast until it expires.
          breakerUntil = Date.now() + BREAKER_MS
          throw new AniListError('AniList API disabled upstream', 403)
        }

        if (res.status === 429) {
          // Documented rate limit: worth a short backoff and retry.
          await sleep(1000 * (attempt + 1))
          continue
        }

        if (!res.ok) {
          const body = await res.text()
          throw new AniListError(`AniList responded ${res.status}`, res.status, body.slice(0, 400))
        }

        const json = (await res.json()) as GraphQLResponse<T>
        if (json.errors?.length) {
          const msg = json.errors.map((e) => e.message).join('; ')
          // AniList returns 404-style "Not Found" as a GraphQL error for bad ids.
          throw new AniListError(msg, json.errors[0].status, json.errors)
        }
        if (!json.data) throw new AniListError('AniList returned an empty payload')

        cacheSet(key, json.data, ttl)
        return json.data
      } catch (err) {
        lastErr = err
        if (err instanceof AniListError && err.status && err.status < 500) throw err
        await sleep(300 * (attempt + 1))
      }
    }

    // Upstream is down. Serve a stale entry if we have one rather than
    // failing the page; `data` may be incomplete, so surface it as a warning.
    const stale = cacheGetStale<T>(key)
    if (stale !== null) {
      console.warn('[anilist] serving stale cache after upstream failure')
      return stale
    }

    throw lastErr instanceof Error ? lastErr : new AniListError('AniList request failed')
  })()

  inflight.set(key, run)
  try {
    return await run
  } finally {
    inflight.delete(key)
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/* ---------------------------------------------------------------- fragments */

const MEDIA_CORE = `
  id
  idMal
  title { romaji english native userPreferred }
  description(asHtml: false)
  coverImage { extraLarge large medium color }
  bannerImage
  format
  status
  season
  seasonYear
  episodes
  duration
  countryOfOrigin
  source
  trailer { id site thumbnail }
  averageScore
  meanScore
  popularity
  favourites
  genres
  isAdult
  startDate { year month day }
  endDate { year month day }
  nextAiringEpisode { id episode airingAt timeUntilAiring }
  studios(isMain: true) { edges { isMain node { id name isAnimationStudio } } }
`

/* ----------------------------------------------------------------- queries */

const Q_TRENDING = `
query Trending($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage perPage }
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_CORE} }
  }
}`

const Q_POPULAR = `
query Popular($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage perPage }
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_CORE} }
  }
}`

const Q_TOP_RATED = `
query TopRated($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage perPage }
    media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ${MEDIA_CORE} }
  }
}`

const Q_AIRING_NOW = `
query AiringNow($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage perPage }
    media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_CORE} }
  }
}`

const Q_SEARCH = `
query Search(
  $page: Int, $perPage: Int, $search: String,
  $genre_in: [String], $seasonYear: Int, $season: MediaSeason,
  $format: MediaFormat, $status: MediaStatus, $averageScore_greater: Int,
  $sort: [MediaSort]
) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage perPage }
    media(
      type: ANIME, isAdult: false, search: $search, genre_in: $genre_in,
      seasonYear: $seasonYear, season: $season, format: $format,
      status: $status, averageScore_greater: $averageScore_greater, sort: $sort
    ) { ${MEDIA_CORE} }
  }
}`

const Q_BY_ID = `
query ById($id: Int) {
  Media(id: $id, type: ANIME) {
    ${MEDIA_CORE}
    chapters
    volumes
    hashtag
    synonyms
    tags { id name rank isMediaSpoiler }
    externalLinks { id site url type }
    streamingEpisodes { title thumbnail url site }
    staff(perPage: 12, sort: RELEVANCE) {
      edges { role node { id name { full } image { large } } }
    }
    characters(perPage: 12, sort: [ROLE, RELEVANCE]) {
      edges {
        id
        role
        node { id name { full native } image { large medium } }
        voiceActors(language: JAPANESE) { id name { full } image { large } }
      }
    }
    relations {
      edges { id relationType node { ${MEDIA_CORE} } }
    }
    recommendations(perPage: 12, sort: RATING_DESC) {
      nodes {
        id
        rating
        mediaRecommendation { ${MEDIA_CORE} }
      }
    }
  }
}`

const Q_SCHEDULE = `
query Schedule($from: Int, $to: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage perPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to) {
      id
      episode
      airingAt
      timeUntilAiring
      media { ${MEDIA_CORE} }
    }
  }
}`

const Q_AIRING_FOR_MEDIA = `
query AiringForMedia($id: Int) {
  Media(id: $id) {
    airingSchedule(notYetAired: true, perPage: 30) {
      nodes { id episode airingAt timeUntilAiring }
    }
  }
}`

const Q_GENRES = `
query Genres {
  GenreCollection
}`

const Q_STUDIOS = `
query Studios($search: String) {
  Page(page: 1, perPage: 10) {
    studios(search: $search, sort: SEARCH_MATCH) { id name isAnimationStudio }
  }
}`

/* ----------------------------------------------------------------- the API */

export async function trending(page = 1, perPage = 20): Promise<Media[]> {
  const d = await gql<{ Page: Page<Media> }>(Q_TRENDING, { page, perPage }, { ttl: TTL.short })
  return d.Page.media
}

export async function popular(page = 1, perPage = 20): Promise<Media[]> {
  const d = await gql<{ Page: Page<Media> }>(Q_POPULAR, { page, perPage }, { ttl: TTL.medium })
  return d.Page.media
}

export async function topRated(page = 1, perPage = 20): Promise<Media[]> {
  const d = await gql<{ Page: Page<Media> }>(Q_TOP_RATED, { page, perPage }, { ttl: TTL.long })
  return d.Page.media
}

export async function airingNow(page = 1, perPage = 20): Promise<Media[]> {
  const d = await gql<{ Page: Page<Media> }>(Q_AIRING_NOW, { page, perPage }, { ttl: TTL.short })
  return d.Page.media
}

export async function search(filters: SearchFilters = {}): Promise<Page<Media>> {
  const {
    q,
    genres,
    year,
    season,
    format,
    status,
    scoreMin,
    studio,
    page = 1,
    perPage = 30,
  } = filters

  // Studio is not a native `media` filter, so resolve it to a name search that
  // we then intersect with the media query by asking for that studio's media.
  if (studio) {
    return searchByStudio(studio, filters)
  }

  const variables: Record<string, unknown> = {
    page,
    perPage: Math.min(perPage, 50),
    search: q?.trim() ? q.trim() : undefined,
    genre_in: genres?.length ? genres : undefined,
    seasonYear: year ?? undefined,
    season: season ?? undefined,
    format: format ?? undefined,
    status: status ?? undefined,
    averageScore_greater: scoreMin ?? undefined,
    sort: filters.sort?.length ? filters.sort : q?.trim() ? ['SEARCH_MATCH'] : ['POPULARITY_DESC'],
  }

  const d = await gql<{ Page: Page<Media> }>(Q_SEARCH, variables, { ttl: TTL.short })
  return d.Page
}

/**
 * `Studio.media` only accepts sort/isMain/onList/page/perPage, so genre, year,
 * format, status and score have to be applied here after the fetch.
 */
async function searchByStudio(studio: string, filters: SearchFilters): Promise<Page<Media>> {
  const page = filters.page ?? 1
  const perPage = Math.min(filters.perPage ?? 30, 50)

  const wantsFiltering =
    Boolean(filters.genres?.length) ||
    filters.year != null ||
    Boolean(filters.format) ||
    Boolean(filters.status) ||
    filters.scoreMin != null

  const query = `
  query ByStudio($studio: String, $page: Int, $perPage: Int, $sort: [MediaSort]) {
    Studio(search: $studio) {
      id
      name
      media(page: $page, perPage: $perPage, sort: $sort, isMain: true) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        nodes { ${MEDIA_CORE} }
      }
    }
  }`

  const d = await gql<{
    Studio: { id: number; name: string; media: { pageInfo: PageInfo; nodes: Media[] } } | null
  }>(
    query,
    {
      studio,
      page,
      // Over-fetch when local filtering is needed so a page is not emptied out.
      perPage: wantsFiltering ? 50 : perPage,
      sort: filters.sort?.length ? filters.sort : ['POPULARITY_DESC'],
    },
    { ttl: TTL.short },
  )

  if (!d.Studio) {
    return {
      pageInfo: { total: 0, currentPage: 1, lastPage: 0, hasNextPage: false, perPage },
      media: [],
    }
  }

  let nodes = d.Studio.media.nodes
  if (wantsFiltering) {
    nodes = nodes.filter((m) => {
      if (filters.genres?.length && !filters.genres.every((g) => m.genres?.includes(g))) return false
      if (filters.year != null && m.seasonYear !== filters.year) return false
      if (filters.format && m.format !== filters.format) return false
      if (filters.status && m.status !== filters.status) return false
      if (filters.scoreMin != null && (m.averageScore ?? 0) < filters.scoreMin) return false
      return true
    })
  }

  return {
    pageInfo: { ...d.Studio.media.pageInfo, perPage: nodes.length || perPage },
    media: nodes.slice(0, perPage),
  }
}

export async function byId(id: number): Promise<Media> {
  const d = await gql<{ Media: Media }>(Q_BY_ID, { id }, { ttl: TTL.medium })
  return d.Media
}

export interface AiringScheduleEntry {
  id: number
  episode: number
  airingAt: number
  timeUntilAiring: number
  media: Media
  /**
   * False when the provider only published a date (no clock time), in which
   * case `airingAt` is midnight UTC of that date and must not be rendered as a
   * precise air time.
   */
  timeKnown?: boolean
  /**
   * True only when the slot itself was invented (no provider published a date).
   * Real dates are `derived: false` even though their clock time is unknown.
   */
  derived?: boolean
}

export async function airingSchedule(from: number, to: number, page = 1, perPage = 50) {
  const d = await gql<{ Page: { pageInfo: PageInfo; airingSchedules: AiringScheduleEntry[] } }>(
    Q_SCHEDULE,
    { from, to, page, perPage },
    { ttl: TTL.short },
  )
  return d.Page
}

export async function airingScheduleForMedia(id: number): Promise<AiringEpisode[]> {
  const d = await gql<{ Media: { airingSchedule: { nodes: AiringEpisode[] } | null } }>(
    Q_AIRING_FOR_MEDIA,
    { id },
    { ttl: TTL.short },
  )
  return d.Media.airingSchedule?.nodes ?? []
}

export async function genres(): Promise<string[]> {
  const d = await gql<{ GenreCollection: string[] }>(Q_GENRES, {}, { ttl: TTL.long })
  return d.GenreCollection
}

export async function studioSearch(term: string) {
  const d = await gql<{ Page: { studios: Studio[] } }>(Q_STUDIOS, { search: term }, { ttl: TTL.long })
  return d.Page.studios
}

/* ------------------------------------------------------------------ helpers */

export function titleOf(m: Pick<Media, 'title'> | null | undefined): string {
  if (!m?.title) return 'Unknown'
  return m.title.userPreferred || m.title.english || m.title.romaji || m.title.native || 'Unknown'
}

export function posterOf(m: Pick<Media, 'coverImage'> | null | undefined): string {
  return m?.coverImage?.extraLarge || m?.coverImage?.large || m?.coverImage?.medium || ''
}

export function scoreOf(m: Pick<Media, 'averageScore' | 'meanScore'>): number | null {
  return m.averageScore ?? m.meanScore ?? null
}

export function formatLabel(f: MediaFormat | null | undefined): string {
  if (!f) return '—'
  return f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const STATUS_LABEL: Record<MediaStatus, string> = {
  FINISHED: 'Finished',
  RELEASING: 'Airing',
  NOT_YET_RELEASED: 'Upcoming',
  CANCELLED: 'Cancelled',
  HIATUS: 'Hiatus',
}

export function statusLabel(s: MediaStatus | null | undefined): string {
  return s ? STATUS_LABEL[s] ?? '—' : '—'
}

export function seasonLabel(season: MediaSeason | null | undefined, year: number | null | undefined) {
  if (!season && !year) return '—'
  const s = season ? season.charAt(0) + season.slice(1).toLowerCase() : ''
  return [s, year].filter(Boolean).join(' ')
}

/** Strip AniList's `<br>` / entity soup down to readable plain text. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function nextEpisodeNumber(m: Pick<Media, 'nextAiringEpisode'>): number | null {
  return m.nextAiringEpisode?.episode ?? null
}

/** Countdown helper shared by the AiringCountdown component and the schedule page. */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'aired'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
