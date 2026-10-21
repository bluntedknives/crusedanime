'use client'

import { useEffect } from 'react'

interface Props {
  anilistId: number
  malId?: number | null
  title: string
  altTitles: string[]
  /** Episode to prefetch; usually the next unwatched one. */
  episode: number
  type: 'sub' | 'dub'
}

/**
 * Fires a fire-and-forget request that resolves and caches the first stream
 * while the visitor is still reading the detail page. Upstream resolution can
 * take tens of seconds, so doing it here turns "Play" into an instant start.
 * Uses `requestIdleCallback` when available so it never competes with the
 * page's own data fetches.
 */
export default function WarmStream({ anilistId, malId, title, altTitles, episode, type }: Props) {
  useEffect(() => {
    if (!title) return

    const params = new URLSearchParams({
      anilistId: String(anilistId),
      episode: String(episode),
      title,
      type,
      warm: '1',
    })
    if (malId) params.set('malId', String(malId))
    altTitles.slice(0, 3).forEach((a) => params.append('alt', a))

    const url = `/api/stream?${params.toString()}`

    const run = () => {
      fetch(url, { keepalive: true }).catch(() => {
        /* warming is best-effort */
      })
    }

    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback

    // Defer slightly so the hero images win the first bandwidth race.
    const timer = setTimeout(() => {
      if (typeof ric === 'function') ric(run)
      else run()
    }, 1200)

    return () => clearTimeout(timer)
  }, [anilistId, malId, title, episode, type, altTitles.join('|')])

  return null
}
