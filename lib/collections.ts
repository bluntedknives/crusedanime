'use client'

/**
 * Smaller persisted collections that do not belong in the main store.
 *
 * Kept apart from `lib/store.ts` because that module owns the watchlist and
 * progress — the data a viewer would be upset to lose — while everything here
 * is convenience state that can be safely discarded. The split also keeps the
 * frequently-imported store from growing every time a feature needs a key.
 */

import { useCallback, useMemo } from 'react'
import { read, useStored, write } from './store'

const K = {
  episodeProgress: 'anistream:episodes:v1',
  dismissed: 'anistream:dismissed:v1',
  notes: 'anistream:notes:v1',
  goal: 'anistream:goal:v1',
  recentSearches: 'anistream:recent-searches:v1',
} as const

/* ------------------------------------------------- per-episode watched flags */

/**
 * Which episodes have been marked watched, as `animeId:episode` keys.
 *
 * Distinct from playback progress: a viewer can finish an episode elsewhere or
 * simply want to tick one off, and neither writes a resume point. A Set keyed
 * by string keeps the check O(1) for a list that re-renders on every scroll.
 */
export function useEpisodeProgress() {
  const [keys, setKeys, sync] = useStored<string[]>(K.episodeProgress, [])
  const watched = useMemo(() => new Set(keys), [keys])

  const keyOf = (animeId: number, episode: number) => `${animeId}:${episode}`

  const isWatched = useCallback(
    (animeId: number, episode: number) => watched.has(keyOf(animeId, episode)),
    [watched],
  )

  const toggle = useCallback(
    (animeId: number, episode: number) => {
      const current = new Set(read<string[]>(K.episodeProgress, []))
      const k = keyOf(animeId, episode)
      if (current.has(k)) current.delete(k)
      else current.add(k)
      setKeys([...current])
    },
    [setKeys],
  )

  const markWatched = useCallback(
    (animeId: number, episode: number, value = true) => {
      const current = new Set(read<string[]>(K.episodeProgress, []))
      const k = keyOf(animeId, episode)
      if (value) current.add(k)
      else current.delete(k)
      setKeys([...current])
    },
    [setKeys],
  )

  /** Count watched episodes for one title, used by the watchlist progress bar. */
  const countFor = useCallback(
    (animeId: number) => keys.reduce((n, k) => (k.startsWith(`${animeId}:`) ? n + 1 : n), 0),
    [keys],
  )

  const clear = useCallback(() => setKeys([]), [setKeys])

  return { keys, isWatched, toggle, markWatched, countFor, clear, sync }
}

/* ------------------------------------------------------------- dismissals */

/**
 * Generic "do not show this again" set.
 *
 * Several unrelated features need the same shape (hidden recommendations,
 * dismissed banners), so they share one key namespace rather than each
 * inventing its own storage layout.
 */
export function useDismissed(namespace: string) {
  const [ids, setIds] = useStored<number[]>(`${K.dismissed}:${namespace}`, [])

  const has = useCallback((id: number) => ids.includes(id), [ids])

  const dismiss = useCallback(
    (id: number) => {
      const current = read<number[]>(`${K.dismissed}:${namespace}`, [])
      if (!current.includes(id)) setIds([id, ...current])
    },
    [namespace, setIds],
  )

  const restore = useCallback(
    (id: number) => {
      setIds(read<number[]>(`${K.dismissed}:${namespace}`, []).filter((x) => x !== id))
    },
    [namespace, setIds],
  )

  const clear = useCallback(() => setIds([]), [setIds])

  return { ids, has, dismiss, restore, clear }
}

/* ------------------------------------------------------------------ notes */

/** Free-text notes per title, autosaved from the detail page. */
export function useNotes() {
  const [notes, setNotes] = useStored<Record<number, string>>(K.notes, {})

  const get = useCallback((id: number) => notes[id] ?? '', [notes])

  const set = useCallback(
    (id: number, text: string) => {
      const map = { ...read<Record<number, string>>(K.notes, {}) }
      if (text.trim()) map[id] = text
      else delete map[id]
      setNotes(map)
    },
    [setNotes],
  )

  const clear = useCallback(() => setNotes({}), [setNotes])

  return { notes, get, set, clear, count: Object.keys(notes).length }
}

/* ------------------------------------------------------------- daily goal */

export interface DailyGoal {
  /** Episodes per day. */
  target: number
}

const DEFAULT_GOAL: DailyGoal = { target: 3 }

export function useDailyGoal() {
  const [stored, setStored] = useStored<DailyGoal>(K.goal, DEFAULT_GOAL)
  const goal = useMemo(() => ({ ...DEFAULT_GOAL, ...stored }), [stored])

  const setTarget = useCallback(
    (target: number) => setStored({ target: Math.max(1, Math.min(50, Math.round(target))) }),
    [setStored],
  )

  return { goal, setTarget }
}

/* -------------------------------------------------------- recent searches */

const RECENT_LIMIT = 8

/**
 * Recent search terms, newest first, deduped case-insensitively.
 *
 * Stored separately from the URL so the suggestions survive a refresh even
 * when the viewer lands on the search page with no query.
 */
export function useRecentSearches() {
  const [terms, setTerms] = useStored<string[]>(K.recentSearches, [])

  const push = useCallback(
    (term: string) => {
      const t = term.trim()
      if (t.length < 2) return
      const list = read<string[]>(K.recentSearches, [])
      const lower = t.toLowerCase()
      const next = [t, ...list.filter((x) => x.toLowerCase() !== lower)].slice(0, RECENT_LIMIT)
      setTerms(next)
    },
    [setTerms],
  )

  const remove = useCallback(
    (term: string) => {
      setTerms(read<string[]>(K.recentSearches, []).filter((x) => x !== term))
    },
    [setTerms],
  )

  const clear = useCallback(() => setTerms([]), [setTerms])

  return { terms, push, remove, clear }
}

/* --------------------------------------------------------------- new badge */

/**
 * Track which titles a viewer has already seen, so cards can show a "new"
 * badge for recently added entries. Written on first render of a detail page.
 */
const SEEN_KEY = 'anistream:seen:v1'

export function markSeen(id: number): void {
  const seen = read<number[]>(SEEN_KEY, [])
  if (seen.includes(id)) return
  write(SEEN_KEY, [id, ...seen].slice(0, 2000))
}

export function hasSeen(id: number): boolean {
  return read<number[]>(SEEN_KEY, []).includes(id)
}
