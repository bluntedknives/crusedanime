import * as cinemeta from './cinemeta'
import * as archive from './archive'
import type { Media } from './anilist'

/**
 * Films and western series, adapted into the app's existing `Media` shape.
 *
 * Everything downstream — PosterCard, the watchlist, progress, the player — is
 * written against `Media` with a numeric id, so rather than fork those
 * components the movie catalogue is mapped into the same shape. Two rules make
 * that safe:
 *
 *  1. **Ids are negative.** AniList ids are positive, so `-id` can never
 *     collide. `isMovieId` is the single test used to branch behaviour, and the
 *     IMDb id rides along in `synonyms[0]` for round-tripping back to Cinemeta.
 *  2. **Only fields the components read are populated.** The rest stay null,
 *     which every helper already tolerates (`formatLabel` -> '—', etc.).
 *
 * A film is one "episode". That is what lets the existing player, progress
 * store and continue-watching rail work untouched.
 */

/** AniList ids are positive; a negative id is always ours. */
export function isMovieId(id: number): boolean {
  return Number.isFinite(id) && id < 0
}

export function toImdbId(id: number): string | null {
  const raw = String(Math.abs(id))
  return /^\d+$/.test(raw) ? `tt${raw.padStart(7, '0')}` : null
}

/** `tt0121955` -> `-121955`, so the id is reversible and collision-free. */
export function toMediaId(imdbId: string): number {
  const digits = imdbId.replace(/^tt/, '').replace(/\D/g, '')
  return -Number(digits)
}

function kindOf(id: number): cinemeta.Kind {
  return String(Math.abs(id)).length === 7 ? 'movie' : 'series'
}

/**
 * Cinemeta ids are IMDb ids, and IMDb numbers films at seven digits
 * (`tt0121955`) while series use eight (`tt12345678`). That length is the only
 * signal available from the id alone, so it is used to pick the catalog, and
 * `adaptDetail` corrects it from the authoritative `type` when a detail loads.
 */
export function adapt(item: cinemeta.CatalogItem): Media {
  const imdb = item.imdb_id ?? item.id
  const id = toMediaId(imdb)
  const year = item.year ? Number(String(item.year).slice(0, 4)) : null
  const isSeries = item.type === 'series'
  const rating = item.imdbRating ? Number(item.imdbRating) : null

  return {
    id,
    idMal: null,
    title: { romaji: item.name, english: item.name, native: null, userPreferred: item.name },
    description: item.description ?? null,
    coverImage: {
      extraLarge: item.poster ?? null,
      large: item.poster ?? null,
      medium: item.poster ?? null,
      color: null,
    },
    bannerImage: item.background ?? null,
    format: isSeries ? 'TV' : 'MOVIE',
    status: null,
    season: null,
    seasonYear: Number.isFinite(year) ? year : null,
    // A film is a single playable unit; a series reports its episode count.
    episodes: isSeries ? null : 1,
    duration: null,
    chapters: null,
    volumes: null,
    countryOfOrigin: null,
    source: null,
    hashtag: null,
    trailer: null,
    // Cinemeta rates out of 10; the UI's score ramp is AniList's 0-100.
    averageScore: rating != null ? Math.round(rating * 10) : null,
    meanScore: null,
    popularity: null,
    favourites: null,
    genres: item.genres ?? null,
    // `synonyms` carries the IMDb id back to Cinemeta; see `imdbOf`.
    synonyms: [imdb],
    isAdult: false,
    startDate: null,
    endDate: null,
    nextAiringEpisode: null,
    studios: null,
    staff: null,
    characters: null,
    relations: null,
    recommendations: null,
    tags: null,
    externalLinks: null,
    streamingEpisodes: null,
    airingSchedule: null,
  }
}

/** Read the IMDb id back out of an adapted `Media`. */
export function imdbOf(media: Media): string | null {
  return media.synonyms?.[0] ?? toImdbId(media.id)
}

/* --------------------------------------------------------------- browse --- */

export async function popularMovies(limit = 24): Promise<Media[]> {
  const items = await cinemeta.popular('movie', limit)
  return items.map(adapt)
}

export async function popularSeries(limit = 24): Promise<Media[]> {
  const items = await cinemeta.popular('series', limit)
  return items.map(adapt)
}

export async function byGenre(genre: string, kind: cinemeta.Kind, limit = 24): Promise<Media[]> {
  const items = await cinemeta.byGenre(kind, genre, limit)
  return items.map(adapt)
}

export async function search(query: string, limit = 12): Promise<Media[]> {
  const [films, shows] = await Promise.all([
    cinemeta.search(query, 'movie', limit).catch(() => []),
    cinemeta.search(query, 'series', limit).catch(() => []),
  ])
  // Interleave so a query does not return a solid block of one kind.
  const out: cinemeta.CatalogItem[] = []
  for (let i = 0; i < Math.max(films.length, shows.length); i++) {
    if (films[i]) out.push(films[i])
    if (shows[i]) out.push(shows[i])
  }
  return out.slice(0, limit).map(adapt)
}

export async function detail(id: number): Promise<cinemeta.Detail | null> {
  const imdb = toImdbId(id)
  if (!imdb) return null
  // Try the length-implied kind first, then the other, so a wrong guess costs
  // one extra request rather than a dead page.
  const first = kindOf(id)
  const second: cinemeta.Kind = first === 'movie' ? 'series' : 'movie'
  return (await cinemeta.detail(first, imdb)) ?? (await cinemeta.detail(second, imdb))
}

/**
 * Episode list for a series, normalised to 1-based numbering. Cinemeta returns
 * a flat `videos` array across all seasons; the UI numbers films as episode 1.
 */
export function episodesOf(detail: cinemeta.Detail): cinemeta.Episode[] {
  const videos = detail.videos ?? []
  if (detail.type !== 'series') return []
  return [...videos]
    .filter((v) => v.number != null || v.episode != null)
    .sort((a, b) => {
      // Season 0 holds specials and unaired pilots. Sorting it first would make
      // "Episode 1" a behind-the-scenes reel instead of the actual first
      // episode, so it is pushed to the end.
      const sa = a.season || Number.MAX_SAFE_INTEGER
      const sb = b.season || Number.MAX_SAFE_INTEGER
      return sa - sb || (a.number ?? 0) - (b.number ?? 0)
    })
}

/**
 * Films that are known to be playable right now.
 *
 * Built from the public-domain film set rather than from popularity, because
 * the popular catalogues contain almost nothing that is free to stream. Each
 * entry is matched to Cinemeta so it has a proper detail page and id.
 */
export async function playableNow(limit = 18): Promise<Media[]> {
  const items = await archive.browse(limit * 2)
  const resolved = await Promise.all(
    items.map(async (item) => {
      const match = await cinemeta.search(item.title, 'movie', 3).catch(() => [])
      const hit = match.find((m) => archive.titlesMatch(m.name, item.title))
      return hit ? adapt(hit) : null
    }),
  )
  const seen = new Set<number>()
  return resolved
    .filter((m): m is Media => m !== null)
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .slice(0, limit)
}

/** Playable source for a film. Null when nothing close enough is public. */
export async function sourceFor(id: number, title: string, year: number | null) {
  return archive.sourceFor(title, year ? String(year) : null)
}
