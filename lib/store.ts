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

/** `updatedAt` is stamped on write, so callers do not supply it. */
export type ProgressInput = Omit<ProgressEntry, 'updatedAt'>

export type ViewMode = 'grid' | 'list'

const K = {
  watchlist: 'anistream:watchlist:v1',
  progress: 'anistream:progress:v1',
  view: 'anistream:view:v1',
  prefs: 'anistream:prefs:v1',
} as const

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
  }
}

/* ------------------------------------------------------------------- hooks */

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [ready, setReady] = useState(false)

  const sync = useCallback(() => {
    setEntries(read<WatchlistEntry[]>(K.watchlist, []))
  }, [])

  useEffect(() => {
    sync()
    setReady(true)
    const onStore = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail
      if (!detail || detail.key === K.watchlist) sync()
    }
    window.addEventListener('anistream:store', onStore)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('anistream:store', onStore)
      window.removeEventListener('storage', sync)
    }
  }, [sync])

  const has = useCallback((id: number) => entries.some((e) => e.id === id), [entries])

  const add = useCallback(
    (m: Media, status: WatchStatus = 'planned') => {
      const list = read<WatchlistEntry[]>(K.watchlist, [])
      if (list.some((e) => e.id === m.id)) return
      write(K.watchlist, [toEntry(m, status), ...list])
      sync()
    },
    [sync],
  )

  const remove = useCallback(
    (id: number) => {
      write(
        K.watchlist,
        read<WatchlistEntry[]>(K.watchlist, []).filter((e) => e.id !== id),
      )
      sync()
    },
    [sync],
  )

  const toggle = useCallback(
    (m: Media) => {
      const list = read<WatchlistEntry[]>(K.watchlist, [])
      if (list.some((e) => e.id === m.id)) {
        write(K.watchlist, list.filter((e) => e.id !== m.id))
      } else {
        write(K.watchlist, [toEntry(m), ...list])
      }
      sync()
    },
    [sync],
  )

  const setStatus = useCallback(
    (id: number, status: WatchStatus) => {
      write(
        K.watchlist,
        read<WatchlistEntry[]>(K.watchlist, []).map((e) =>
          e.id === id ? { ...e, status, updatedAt: Date.now() } : e,
        ),
      )
      sync()
    },
    [sync],
  )

  const clear = useCallback(() => {
    write(K.watchlist, [])
    sync()
  }, [sync])

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

  return { entries, ready, has, add, remove, toggle, setStatus, clear, byStatus }
}

export function useProgress() {
  const [all, setAll] = useState<Record<string, ProgressEntry>>({})

  const sync = useCallback(() => {
    setAll(read<Record<string, ProgressEntry>>(K.progress, {}))
  }, [])

  useEffect(() => {
    sync()
    const onStore = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail
      if (!detail || detail.key === K.progress) sync()
    }
    window.addEventListener('anistream:store', onStore)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('anistream:store', onStore)
      window.removeEventListener('storage', sync)
    }
  }, [sync])

  const save = useCallback(
    (entry: ProgressInput) => {
      const map = read<Record<string, ProgressEntry>>(K.progress, {})
      const key = `${entry.animeId}:${entry.type}`
      map[key] = { ...entry, updatedAt: Date.now() }
      write(K.progress, map)
      sync()
    },
    [sync],
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
      write(K.progress, map)
      sync()
    },
    [sync],
  )

  const clear = useCallback(() => {
    write(K.progress, {})
    sync()
  }, [sync])

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

export function useViewMode() {
  const [mode, setModeState] = useState<ViewMode>('grid')
  useEffect(() => {
    setModeState(read<ViewMode>(K.view, 'grid'))
  }, [])
  const setMode = useCallback((m: ViewMode) => {
    write(K.view, m)
    setModeState(m)
  }, [])
  return { mode, setMode }
}

export interface Prefs {
  preferredType: 'sub' | 'dub'
  autoPlay: boolean
  autoNext: boolean
  skipIntro: boolean
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>({
    preferredType: 'sub',
    autoPlay: true,
    autoNext: true,
    skipIntro: false,
  })

  useEffect(() => {
    setPrefs(read<Prefs>(K.prefs, prefs))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      write(K.prefs, next)
      return next
    })
  }, [])

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
