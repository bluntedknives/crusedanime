'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatLabel, posterOf, scoreOf, titleOf, type Media } from './anilist'

/* ------------------------------------------------------------------ types */

export type WatchStatus = 'watching' | 'planned' | 'completed' | 'paused' | 'dropped'

export interface WatchlistEntry {
  id: number
  title: string
  poster: string
  banner: string | null
  format: string | null
  year: number | null
  score: number | null
  episodes: number | null
  genres: string[]
  status: WatchStatus
  addedAt: number
  updatedAt: number
  /** Episode count manually marked watched, used for grid progress bars. */
  watchedEpisodes?: number
}

export interface ProgressEntry {
  animeId: number
  episode: number
  position: number
  duration: number
  updatedAt: number
  /** Title/poster are denormalised so the continue-watching rail is one read. */
  title: string
  poster: string
  totalEpisodes: number | null
  type: 'sub' | 'dub'
  /**
   * Furthest point ever reached in the episode, in seconds.
   *
   * `position` is a resume point and moves backwards when a viewer scrubs back
   * or rewatches, so summing it would undercount. Watch time is derived from
   * this instead, which only ever advances.
   */
  watchedSeconds?: number
  /** Copied from the media so stats can group without refetching AniList. */
  genres?: string[]
}

/** One row per playback event, newest first. Powers the history page. */
export interface HistoryEntry {
  animeId: number
  episode: number
  title: string
  poster: string
  type: 'sub' | 'dub'
  watchedAt: number
  /** Fraction of the episode watched at the time of the event (0–1). */
  completion: number
}

/** `updatedAt` is stamped on write, so callers do not supply it. */
export type ProgressInput = Omit<ProgressEntry, 'updatedAt'>

export type ViewMode = 'grid' | 'list'

const K = {
  watchlist: 'anistream:watchlist:v1',
  progress: 'anistream:progress:v1',
  history: 'anistream:history:v1',
  view: 'anistream:view:v1',
  prefs: 'anistream:prefs:v1',
  ratings: 'anistream:ratings:v1',
} as const

const HISTORY_LIMIT = 300

/* ------------------------------------------------------------ safe storage */

export function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function write<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota or private mode: ignore */
  }
  // Same-tab listeners need an explicit nudge; the storage event only fires
  // for other tabs.
  window.dispatchEvent(new CustomEvent('anistream:store', { detail: { key } }))
}

/**
 * Subscribe to a storage key. Returns the parsed value and a setter that
 * writes back, keeping every mounted hook in sync within the tab.
 */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback)

  const sync = useCallback(() => {
    setValue(read<T>(key, fallback))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    sync()
    const onStore = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail
      if (!detail || detail.key === key) sync()
    }
    window.addEventListener('anistream:store', onStore)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('anistream:store', onStore)
      window.removeEventListener('storage', sync)
    }
  }, [key, sync])

  const set = useCallback(
    (next: T) => {
      write(key, next)
      setValue(next)
    },
    [key],
  )

  return [value, set, sync] as const
}

/* -------------------------------------------------------------- conversion */

export function toEntry(m: Media, status: WatchStatus = 'planned'): WatchlistEntry {
  const now = Date.now()
  return {
    id: m.id,
    title: titleOf(m),
    poster: posterOf(m),
    banner: m.bannerImage ?? null,
    format: m.format ? formatLabel(m.format) : null,
    year: m.seasonYear ?? m.startDate?.year ?? null,
    score: scoreOf(m),
    episodes: m.episodes ?? null,
    genres: m.genres ?? [],
    status,
    addedAt: now,
    updatedAt: now,
    watchedEpisodes: 0,
  }
}

/* ------------------------------------------------------------------- hooks */

export function useWatchlist() {
  const [entries, setEntries, sync] = useStored<WatchlistEntry[]>(K.watchlist, [])
  const [ready, setReady] = useState(false)

  useEffect(() => setReady(true), [])

  const has = useCallback((id: number) => entries.some((e) => e.id === id), [entries])

  const get = useCallback((id: number) => entries.find((e) => e.id === id) ?? null, [entries])

  const add = useCallback(
    (m: Media, status: WatchStatus = 'planned') => {
      const list = read<WatchlistEntry[]>(K.watchlist, [])
      if (list.some((e) => e.id === m.id)) return
      setEntries([toEntry(m, status), ...list])
    },
    [setEntries],
  )

  const remove = useCallback(
    (id: number) => {
      setEntries(read<WatchlistEntry[]>(K.watchlist, []).filter((e) => e.id !== id))
    },
    [setEntries],
  )

  const toggle = useCallback(
    (m: Media) => {
      const list = read<WatchlistEntry[]>(K.watchlist, [])
      if (list.some((e) => e.id === m.id)) {
        setEntries(list.filter((e) => e.id !== m.id))
      } else {
        setEntries([toEntry(m), ...list])
      }
    },
    [setEntries],
  )

  const setStatus = useCallback(
    (id: number, status: WatchStatus) => {
      setEntries(
        read<WatchlistEntry[]>(K.watchlist, []).map((e) =>
          e.id === id ? { ...e, status, updatedAt: Date.now() } : e,
        ),
      )
    },
    [setEntries],
  )

  /** Track per-title episode counts so grid cards can show progress. */
  const setWatchedEpisodes = useCallback(
    (id: number, count: number) => {
      setEntries(
        read<WatchlistEntry[]>(K.watchlist, []).map((e) =>
          e.id === id ? { ...e, watchedEpisodes: Math.max(0, count), updatedAt: Date.now() } : e,
        ),
      )
    },
    [setEntries],
  )

  const clear = useCallback(() => setEntries([]), [setEntries])

  const byStatus = useMemo(() => {
    const groups: Record<WatchStatus, WatchlistEntry[]> = {
      watching: [],
      planned: [],
      completed: [],
      paused: [],
      dropped: [],
    }
    for (const e of entries) groups[e.status]?.push(e)
    return groups
  }, [entries])

  return {
    entries,
    ready,
    has,
    get,
    add,
    remove,
    toggle,
    setStatus,
    setWatchedEpisodes,
    clear,
    byStatus,
    sync,
  }
}

export function useProgress() {
  const [all, setAll] = useStored<Record<string, ProgressEntry>>(K.progress, {})

  const save = useCallback(
    (entry: ProgressInput) => {
      const map = read<Record<string, ProgressEntry>>(K.progress, {})
      const key = `${entry.animeId}:${entry.type}`
      const prev = map[key]
      // Watch time only ever advances. A resume point legitimately moves
      // backwards when the viewer scrubs, so `position` cannot be summed, and
      // this is also what keeps a rewatch from double-counting.
      const reached = Math.max(prev?.watchedSeconds ?? 0, entry.position)
      map[key] = {
        ...entry,
        watchedSeconds: reached,
        // Preserve genres once known; a later save may not carry them.
        genres: entry.genres?.length ? entry.genres : prev?.genres,
        updatedAt: Date.now(),
      }
      setAll(map)
    },
    [setAll],
  )

  const get = useCallback(
    (animeId: number, type: 'sub' | 'dub' = 'sub') => all[`${animeId}:${type}`] ?? null,
    [all],
  )

  const remove = useCallback(
    (animeId: number) => {
      const map = read<Record<string, ProgressEntry>>(K.progress, {})
      for (const k of Object.keys(map)) {
        if (map[k].animeId === animeId) delete map[k]
      }
      setAll(map)
    },
    [setAll],
  )

  const clear = useCallback(() => setAll({}), [setAll])

  const continueWatching = useMemo(
    () =>
      Object.values(all)
        .filter((p) => p.duration > 0 && p.position / p.duration < 0.95)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12),
    [all],
  )

  const recent = useMemo(
    () => Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt),
    [all],
  )

  return { all, save, get, remove, clear, continueWatching, recent }
}

export function useHistory() {
  const [entries, setEntries] = useStored<HistoryEntry[]>(K.history, [])

  /** Collapse repeat views of the same episode, newest first. */
  const record = useCallback(
    (entry: Omit<HistoryEntry, 'watchedAt'>) => {
      const list = read<HistoryEntry[]>(K.history, [])
      const filtered = list.filter(
        (e) => !(e.animeId === entry.animeId && e.episode === entry.episode && e.type === entry.type),
      )
      setEntries([{ ...entry, watchedAt: Date.now() }, ...filtered].slice(0, HISTORY_LIMIT))
    },
    [setEntries],
  )

  const clear = useCallback(() => setEntries([]), [setEntries])

  const remove = useCallback(
    (animeId: number, episode: number, type: 'sub' | 'dub') => {
      setEntries(
        read<HistoryEntry[]>(K.history, []).filter(
          (e) => !(e.animeId === animeId && e.episode === episode && e.type === type),
        ),
      )
    },
    [setEntries],
  )

  /** Episodes watched today / this week / total, plus distinct titles. */
  const stats = useMemo(() => {
    const now = Date.now()
    const dayMs = 86_400_000
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    const weekAgo = now - 7 * dayMs

    let today = 0
    let week = 0
    const titles = new Set<number>()

    for (const e of entries) {
      titles.add(e.animeId)
      if (e.watchedAt >= startOfToday) today++
      if (e.watchedAt >= weekAgo) week++
    }

    return { today, week, total: entries.length, titles: titles.size }
  }, [entries])

  return { entries, record, clear, remove, stats }
}

export function useViewMode() {
  const [mode, setModeStored] = useStored<ViewMode>(K.view, 'grid')
  const setMode = useCallback((m: ViewMode) => setModeStored(m), [setModeStored])
  return { mode, setMode }
}

/**
 * Personal scores, 1–10, separate from the watchlist.
 *
 * AniList has its own rating, but that is community data. This is the viewer's
 * own opinion, which the watchlist status cannot express — "completed" says
 * nothing about whether it was any good.
 */
export function useRatings() {
  const [ratings, setRatings] = useStored<Record<number, number>>(K.ratings, {})

  const get = useCallback((id: number) => ratings[id] ?? null, [ratings])

  const set = useCallback(
    (id: number, score: number | null) => {
      const map = { ...read<Record<number, number>>(K.ratings, {}) }
      if (score == null) delete map[id]
      else map[id] = score
      setRatings(map)
    },
    [setRatings],
  )

  const clear = useCallback(() => setRatings({}), [setRatings])

  const average = useMemo(() => {
    const values = Object.values(ratings)
    if (!values.length) return null
    return values.reduce((a, b) => a + b, 0) / values.length
  }, [ratings])

  return { ratings, get, set, clear, average, count: Object.keys(ratings).length }
}

/* ------------------------------------------------------- backup / restore */

/**
 * Everything this app stores locally, in one object.
 *
 * Used for the export/import round-trip. Only keys this module owns are
 * included, so an import cannot overwrite unrelated site data.
 */
export interface Backup {
  version: 1
  exportedAt: number
  watchlist: WatchlistEntry[]
  progress: Record<string, ProgressEntry>
  history: HistoryEntry[]
  ratings: Record<number, number>
  prefs: Prefs
}

export function exportBackup(): Backup {
  return {
    version: 1,
    exportedAt: Date.now(),
    watchlist: read<WatchlistEntry[]>(K.watchlist, []),
    progress: read<Record<string, ProgressEntry>>(K.progress, {}),
    history: read<HistoryEntry[]>(K.history, []),
    ratings: read<Record<number, number>>(K.ratings, {}),
    prefs: read<Prefs>(K.prefs, DEFAULT_PREFS),
  }
}

export interface ImportResult {
  ok: boolean
  message: string
  counts?: { watchlist: number; progress: number; history: number; ratings: number }
}

/**
 * Restore a backup, merging rather than replacing.
 *
 * Import runs on data the user may have exported from an older build, so every
 * field is validated before it is written — a malformed file should be rejected
 * with a reason, not silently corrupt the library.
 */
export function importBackup(raw: string, mode: 'merge' | 'replace' = 'merge'): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, message: 'That file is not valid JSON.' }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: 'That file does not look like a backup.' }
  }
  const b = parsed as Partial<Backup>
  if (!Array.isArray(b.watchlist) && !b.progress && !Array.isArray(b.history) && !b.ratings) {
    return { ok: false, message: 'No watchlist, progress or history found in that file.' }
  }

  const isEntry = (e: unknown): e is WatchlistEntry =>
    !!e && typeof e === 'object' && Number.isFinite((e as WatchlistEntry).id)

  const incoming = (b.watchlist ?? []).filter(isEntry)
  const incomingProgress = Object.fromEntries(
    Object.entries(b.progress ?? {}).filter(([, v]) => v && typeof v === 'object'),
  )
  const incomingHistory = (b.history ?? []).filter(
    (e): e is HistoryEntry => !!e && typeof e === 'object' && Number.isFinite(e.animeId),
  )
  const incomingRatings = Object.fromEntries(
    Object.entries(b.ratings ?? {}).filter(([, v]) => typeof v === 'number' && v >= 1 && v <= 10),
  )

  const merge = <T>(existing: T[], incomingList: T[], key: (v: T) => string | number): T[] => {
    if (mode === 'replace') return incomingList
    const seen = new Set(existing.map(key))
    return [...existing, ...incomingList.filter((v) => !seen.has(key(v)))]
  }

  write(K.watchlist, merge(read<WatchlistEntry[]>(K.watchlist, []), incoming, (e) => e.id))
  write(K.history, merge(read<HistoryEntry[]>(K.history, []), incomingHistory, (e) => `${e.animeId}:${e.episode}:${e.type}`).slice(0, HISTORY_LIMIT))
  write(K.progress, { ...(mode === 'replace' ? {} : read<Record<string, ProgressEntry>>(K.progress, {})), ...incomingProgress })
  write(K.ratings, { ...(mode === 'replace' ? {} : read<Record<number, number>>(K.ratings, {})), ...incomingRatings })
  if (b.prefs && typeof b.prefs === 'object') write(K.prefs, { ...DEFAULT_PREFS, ...b.prefs })

  return {
    ok: true,
    message: `Imported ${incoming.length} watchlist, ${Object.keys(incomingProgress).length} progress, ${incomingHistory.length} history entries.`,
    counts: {
      watchlist: incoming.length,
      progress: Object.keys(incomingProgress).length,
      history: incomingHistory.length,
      ratings: Object.keys(incomingRatings).length,
    },
  }
}

export interface Prefs {
  preferredType: 'sub' | 'dub'
  autoPlay: boolean
  autoNext: boolean
  skipIntro: boolean
  subtitlesOn: boolean
  /** Storage cap for offline downloads, in MB. 0 disables the cap. */
  downloadCapMb: number
}

const DEFAULT_PREFS: Prefs = {
  preferredType: 'sub',
  autoPlay: true,
  autoNext: true,
  skipIntro: false,
  subtitlesOn: true,
  downloadCapMb: 0,
}

/**
 * Read prefs outside React.
 *
 * The download queue and the cap check run in plain module code, not in a
 * component, so they need a synchronous read rather than the hook.
 */
export function getPrefs(): Prefs {
  return { ...DEFAULT_PREFS, ...read<Prefs>(K.prefs, DEFAULT_PREFS) }
}

export function usePrefs() {
  const [stored, setStored] = useStored<Prefs>(K.prefs, DEFAULT_PREFS)
  // Merge so prefs added after a user already has stored values still apply.
  const prefs = useMemo(() => ({ ...DEFAULT_PREFS, ...stored }), [stored])
  const update = useCallback(
    (patch: Partial<Prefs>) => {
      setStored({ ...read<Prefs>(K.prefs, DEFAULT_PREFS), ...patch })
    },
    [setStored],
  )
  return { prefs, update }
}

/* ----------------------------------------------------------------- helpers */

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function progressPercent(p: Pick<ProgressEntry, 'position' | 'duration'>): number {
  if (!p.duration) return 0
  return Math.min(100, Math.max(0, (p.position / p.duration) * 100))
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

/** Local calendar day key, so streaks follow the viewer's clock not UTC. */
function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface GenreSlice {
  genre: string
  episodes: number
  minutes: number
  /** Share of total watch time, 0–1. */
  share: number
}

export interface LibraryStats {
  /** Sum of the furthest point reached in every episode, in seconds. */
  watchSeconds: number
  episodesStarted: number
  /** Episodes watched to the end (>= 90% reached). */
  episodesCompleted: number
  titlesStarted: number
  titlesCompleted: number
  /** Mean completion across every episode started, 0–1. */
  completionRate: number
  /** Consecutive days up to today with at least one playback event. */
  streak: number
  longestStreak: number
  /** Distinct days with activity in the last 30. */
  activeDays: number
  genreSlices: GenreSlice[]
  /** Longest single-title run, by episodes touched. */
  topTitle: { title: string; episodes: number } | null
  firstWatchedAt: number | null
}

/**
 * Derive viewing statistics from locally stored progress and history.
 *
 * Watch time comes from `watchedSeconds`, not `position`: a resume point moves
 * backwards when someone scrubs, so summing positions undercounts and a rewatch
 * would be counted twice.
 */
export function useLibraryStats(): LibraryStats {
  const { all } = useProgress()
  const { entries: history } = useHistory()
  const { entries: watchlist } = useWatchlist()

  return useMemo(() => {
    const progress = Object.values(all)
    let watchSeconds = 0
    let episodesCompleted = 0
    const byGenre = new Map<string, { episodes: number; minutes: number }>()
    const byTitle = new Map<number, { title: string; episodes: number }>()
    const titlesStarted = new Set<number>()

    for (const p of progress) {
      const reached = p.watchedSeconds ?? p.position
      watchSeconds += reached
      titlesStarted.add(p.animeId)

      const done = p.duration > 0 && reached / p.duration >= 0.9
      if (done) episodesCompleted++

      const entry = byTitle.get(p.animeId) ?? { title: p.title, episodes: 0 }
      entry.episodes += 1
      byTitle.set(p.animeId, entry)

      // Genres are only present on progress saved by builds that recorded them,
      // so older entries simply do not contribute to the breakdown.
      for (const g of p.genres ?? []) {
        const slice = byGenre.get(g) ?? { episodes: 0, minutes: 0 }
        slice.episodes += 1
        slice.minutes += reached / 60
        byGenre.set(g, slice)
      }
    }

    const genreSlices: GenreSlice[] = [...byGenre.entries()]
      .map(([genre, v]) => ({
        genre,
        episodes: v.episodes,
        minutes: v.minutes,
        share: watchSeconds > 0 ? v.minutes / (watchSeconds / 60) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes)

    const titlesCompleted = watchlist.filter((w) => w.status === 'completed').length

    let topTitle: LibraryStats['topTitle'] = null
    for (const [id, v] of byTitle) {
      if (!topTitle || v.episodes > topTitle.episodes) topTitle = { title: v.title, episodes: v.episodes }
      void id
    }

    // Streak: walk backwards from today while each day has activity.
    const days = new Set(history.map((h) => dayKey(h.watchedAt)))
    const DAY = 86_400_000
    const todayStart = new Date().setHours(0, 0, 0, 0)
    let streak = 0
    // Yesterday still counts as an unbroken streak — a viewer should not lose it
    // at midnight before watching anything.
    const offset = days.has(dayKey(todayStart)) ? 0 : 1
    if (days.has(dayKey(todayStart - offset * DAY)) || offset === 0) {
      for (let i = offset; i < 3650; i++) {
        if (!days.has(dayKey(todayStart - i * DAY))) break
        streak++
      }
    }

    let longestStreak = 0
    if (days.size) {
      const sorted = [...days].sort()
      let run = 1
      longestStreak = 1
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(`${sorted[i - 1]}T00:00:00`).getTime()
        const cur = new Date(`${sorted[i]}T00:00:00`).getTime()
        run = cur - prev === DAY ? run + 1 : 1
        if (run > longestStreak) longestStreak = run
      }
    }

    const thirtyDaysAgo = todayStart - 30 * DAY
    const activeDays = [...days].filter((d) => new Date(`${d}T00:00:00`).getTime() >= thirtyDaysAgo).length

    const started = progress.length
    return {
      watchSeconds,
      episodesStarted: started,
      episodesCompleted,
      titlesStarted: titlesStarted.size,
      titlesCompleted,
      completionRate: started ? episodesCompleted / started : 0,
      streak,
      longestStreak,
      activeDays,
      genreSlices,
      topTitle,
      firstWatchedAt: history.length ? history[history.length - 1].watchedAt : null,
    }
  }, [all, history, watchlist])
}

/** "12h 34m" — watch time reads better than a raw second count. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m'
  const days = Math.floor(seconds / 86_400)
  const h = Math.floor((seconds % 86_400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
