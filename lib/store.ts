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
} as const

const HISTORY_LIMIT = 300

/* ------------------------------------------------------------ safe storage */

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
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
function useStored<T>(key: string, fallback: T) {
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
      map[key] = { ...entry, updatedAt: Date.now() }
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

export interface Prefs {
  preferredType: 'sub' | 'dub'
  autoPlay: boolean
  autoNext: boolean
  skipIntro: boolean
  subtitlesOn: boolean
}

const DEFAULT_PREFS: Prefs = {
  preferredType: 'sub',
  autoPlay: true,
  autoNext: true,
  skipIntro: false,
  subtitlesOn: true,
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
