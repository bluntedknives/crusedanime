/**
 * Cinemeta — movie and TV metadata.
 *
 * AniList is anime-only, so films and western series (South Park and friends)
 * need a second catalogue. Cinemeta is Stremio's own keyless metadata index
 * (IMDb-derived via TMDB), which avoids adding a TMDB key requirement and
 * covers both films and series, including per-episode lists.
 *
 * Titles are identified by their IMDb id (`tt0121955`). See `lib/movies.ts` for
 * how that is mapped into the app's numeric-id world.
 */

const BASE = 'https://v3-cinemeta.strem.io'

/**
 * A series with many seasons returns hundreds of entries; the response is
 * large and changes slowly, so it is cached hard.
 */
const TTL_MS = 20 * 60 * 1000
const cache = new Map<string, { at: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

async function api<T>(path: string): Promise<T> {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T

  const pending = inflight.get(path)
  if (pending) return pending as Promise<T>

  const run = (async () => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) throw new Error(`cinemeta ${path} -> ${res.status}`)
    const json = (await res.json()) as T
    cache.set(path, { at: Date.now(), value: json })
    return json
  })()

  inflight.set(path, run)
  try {
    return await run
  } finally {
    inflight.delete(path)
  }
}

export type Kind = 'movie' | 'series'

export interface CatalogItem {
  id: string
  imdb_id?: string
  type: Kind
  name: string
  poster?: string
  background?: string
  year?: string
  imdbRating?: string
  description?: string
  genres?: string[]
}

export interface Episode {
  id: string
  name?: string
  season?: number
  number?: number
  episode?: number
  released?: string
  overview?: string
  thumbnail?: string
}

export interface Detail extends CatalogItem {
  runtime?: string
  releaseInfo?: string
  logo?: string
  cast?: string[]
  director?: string[]
  writer?: string[]
  country?: string
  videos?: Episode[]
  videosCount?: number
}

/**
 * Genre list, from the manifest. Films and series differ slightly (the latter
 * adds Reality-TV / Talk-Show / Game-Show), so the union is offered.
 */
export const GENRES = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Mystery', 'Romance', 'Sci-Fi',
  'Sport', 'Thriller', 'War', 'Western', 'Reality-TV', 'Talk-Show', 'Game-Show',
] as const

/**
 * Genre and year catalogs live on a separate host and answer with a 307, so the
 * redirect must be followed explicitly — `fetch` does not follow one that
 * changes host while preserving the path shape here.
 */
async function catalog(kind: Kind, id: 'top' | 'year', extra = ''): Promise<CatalogItem[]> {
  const suffix = extra ? `/${extra}` : ''
  const res = await fetch(`${BASE}/catalog/${kind}/${id}${suffix}.json`, {
    redirect: 'follow',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`cinemeta catalog ${kind}/${id} -> ${res.status}`)
  const json = (await res.json()) as { metas?: CatalogItem[] }
  return (json.metas ?? []).map(normalise)
}

/** Cinemeta omits `type` on catalog rows, so stamp the one we asked for. */
function normalise(m: CatalogItem): CatalogItem {
  return { ...m, type: m.type ?? 'movie' }
}

export async function popular(kind: Kind, limit = 24): Promise<CatalogItem[]> {
  const items = await catalog(kind, 'top')
  return items.slice(0, limit)
}

export async function byGenre(kind: Kind, genre: string, limit = 24): Promise<CatalogItem[]> {
  const items = await catalog(kind, 'top', `genre=${encodeURIComponent(genre)}`)
  return items.slice(0, limit)
}

export async function search(query: string, kind: Kind, limit = 24): Promise<CatalogItem[]> {
  const items = await catalog(kind, 'top', `search=${encodeURIComponent(query)}`)
  return items.slice(0, limit)
}

export async function detail(kind: Kind, imdbId: string): Promise<Detail | null> {
  try {
    const json = await api<{ meta?: Detail }>(`/meta/${kind}/${imdbId}.json`)
    const meta = json.meta
    if (!meta) return null
    return { ...meta, type: kind, imdb_id: meta.imdb_id ?? imdbId }
  } catch {
    return null
  }
}
