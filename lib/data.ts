import * as anilist from './anilist'
import * as kitsu from './kitsu'
import * as preview from './preview'
import type { AiringScheduleEntry, Media } from './anilist'

/**
 * Read-through wrappers used by server components.
 *
 * Provider order is AniList -> Kitsu -> offline preview set. AniList is
 * authoritative when reachable. Kitsu is an independent real provider (real
 * titles, synopses, scores, episode lists and trailers) and is preferred over
 * the seeds whenever it answers, so the UI only ever shows invented content
 * when *both* live providers are down.
 *
 * The `preview` flag means "these are placeholders" and must only be set when
 * the seed set was actually used — never merely because a row came from Kitsu.
 */

export interface Result<T> {
  data: T
  preview: boolean
}

async function attempt<T>(
  live: () => Promise<T>,
  backup: (() => Promise<T>) | null,
  fallback: () => T,
  isEmpty: (v: T) => boolean,
): Promise<Result<T>> {
  try {
    const v = await live()
    if (!isEmpty(v)) return { data: v, preview: false }
  } catch {
    // try the next provider
  }
  if (backup) {
    try {
      const v = await backup()
      if (!isEmpty(v)) return { data: v, preview: false }
    } catch {
      // fall through to preview
    }
  }
  return { data: fallback(), preview: true }
}

export const listOf = (n: number) => (m: Media[]) => m.length === 0
export const take = (n: number) => preview.previewMedia().slice(0, n)

export function trending(page = 1, perPage = 24): Promise<Result<Media[]>> {
  return attempt(
    () => anilist.trending(page, perPage),
    () => kitsu.trending(perPage),
    () => take(perPage),
    listOf(perPage),
  )
}

export function popular(page = 1, perPage = 24): Promise<Result<Media[]>> {
  return attempt(
    () => anilist.popular(page, perPage),
    () => kitsu.popular(perPage),
    () => take(perPage),
    listOf(perPage),
  )
}

export function topRated(page = 1, perPage = 24): Promise<Result<Media[]>> {
  return attempt(
    () => anilist.topRated(page, perPage),
    () => kitsu.topRated(perPage),
    () => take(perPage),
    listOf(perPage),
  )
}

export function airingNow(page = 1, perPage = 24): Promise<Result<Media[]>> {
  return attempt(
    () => anilist.airingNow(page, perPage),
    () => kitsu.airingNow(perPage),
    () => take(perPage),
    listOf(perPage),
  )
}

export interface ScheduleResult extends Result<AiringScheduleEntry[]> {
  /** True when the times are derived rather than provider-published. */
  approximate: boolean
}

/**
 * Airing schedule, best source first:
 *   1. AniList — real times, when its API is up.
 *   2. Kitsu   — real dates from real episode `airdate`s (no clock time).
 *   3. Derived — currently-airing titles spread across the week; flagged
 *      approximate so the UI can say the times are not real.
 */
export async function schedule(from: number, to: number): Promise<ScheduleResult> {
  try {
    const v = (await anilist.airingSchedule(from, to, 1, 50)).airingSchedules
    if (v.length > 0) {
      return {
        data: v.map((e) => ({ ...e, timeKnown: true, derived: false })),
        preview: false,
        approximate: false,
      }
    }
  } catch {
    // fall through
  }

  try {
    const real = await kitsu.upcomingSchedule({ candidates: 60, days: 7 })
    if (real.length > 0) return { data: real, preview: false, approximate: false }
  } catch {
    // fall through
  }

  try {
    const derived = await kitsu.derivedSchedule(20)
    if (derived.length > 0) return { data: derived, preview: false, approximate: true }
  } catch {
    // fall through
  }

  return { data: preview.previewSchedule(), preview: true, approximate: false }
}

export async function byId(id: string | number): Promise<Result<Media | null>> {
  const numeric = Number(id)

  if (Number.isFinite(numeric)) {
    try {
      const m = await anilist.byId(numeric)
      if (m) return { data: m, preview: false }
    } catch {
      // fall through
    }
    try {
      // While AniList is offline a Kitsu record resolves by its own id; for the
      // well-known titles lib/kitsu maps the AniList id onto the Kitsu id.
      const m = await kitsu.byId(numeric)
      if (m) return { data: m, preview: false }
    } catch {
      // fall through
    }
  }

  // Only genuine seed ids fall back to the preview set. An id matching nothing
  // is reported as missing so the page can 404 instead of showing a random
  // title, which is what used to happen.
  const seeded = Number.isFinite(numeric) ? preview.previewById(numeric) : null
  if (seeded) return { data: seeded, preview: true }
  return { data: null, preview: false }
}

/**
 * Search with the same provider chain. The page shape keeps the existing
 * client contract (`{ media, pageInfo }`).
 */
export async function search(
  filters: anilist.SearchFilters = {},
): Promise<Result<anilist.Page<Media>>> {
  try {
    const page = await anilist.search(filters)
    if (page.media.length > 0) return { data: page, preview: false }
  } catch {
    // fall through
  }
  try {
    const perPage = filters.perPage ?? 30
    const page = filters.page ?? 1
    const media = await kitsu.search(filters.q ?? '', perPage, page, {
      year: filters.year,
      season: filters.season,
      format: filters.format,
      status: filters.status,
      scoreMin: filters.scoreMin,
      genres: filters.genres,
    })
    if (media.length > 0) {
      return {
        data: {
          pageInfo: {
            total: media.length,
            currentPage: page,
            lastPage: page,
            hasNextPage: media.length >= perPage,
            perPage,
          },
          media,
        },
        preview: false,
      }
    }
  } catch {
    // fall through
  }
  return {
    data: {
      pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 0 },
      media: [],
    },
    preview: false,
  }
}

export function genres(): Promise<Result<string[]>> {
  return attempt(
    () => anilist.genres(),
    () => kitsu.genres(),
    () => [],
    (v) => v.length === 0,
  )
}
