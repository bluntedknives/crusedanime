'use client'

import { useEffect, useMemo, useState } from 'react'
import MediaRail from './MediaRail'
import { useHistory, useProgress } from '@/lib/store'
import type { Media } from '@/lib/anilist'

/**
 * "Because you watched X" rail.
 *
 * Picks the most recently touched title the viewer has actually made progress
 * in, then pulls its AniList recommendations. Client-side because the seed comes
 * from localStorage; the fetch is deferred to an idle-ish moment so it never
 * competes with the server-rendered rails for bandwidth on first paint.
 */
export default function BecauseYouWatched() {
  const { recent } = useProgress()
  const { entries: history } = useHistory()
  const [items, setItems] = useState<Media[]>([])
  const [seed, setSeed] = useState<{ id: number; title: string } | null>(null)

  // Prefer real progress; fall back to history so a viewer who finished
  // something and had it pruned from progress still gets a rail.
  const seedId = useMemo(() => {
    const fromProgress = recent.find((p) => p.duration > 0)
    if (fromProgress) return { id: fromProgress.animeId, title: fromProgress.title }
    const fromHistory = history[0]
    if (fromHistory) return { id: fromHistory.animeId, title: fromHistory.title }
    return null
  }, [recent, history])

  useEffect(() => {
    if (!seedId) {
      setItems([])
      setSeed(null)
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/anilist?action=byId&id=${seedId.id}`)
        if (!res.ok) return
        const json = await res.json()
        const media: Media | undefined = json?.media ?? json?.data
        const recs = (media?.recommendations?.nodes ?? [])
          .map((n) => n.mediaRecommendation)
          .filter((m): m is Media => !!m && m.id !== seedId.id)
        if (cancelled) return
        setSeed(seedId)
        setItems(recs.slice(0, 18))
      } catch {
        /* offline or malformed: the rail simply does not appear */
      }
    }, 1200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [seedId])

  if (!seed || items.length === 0) return null

  return (
    <MediaRail
      title={`Because you watched ${seed.title}`}
      eyebrow="For you"
      items={items}
      href={`/anime/${seed.id}`}
    />
  )
}
