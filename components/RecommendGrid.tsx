'use client'

import { IconClose } from './icons'
import PosterCard from './PosterCard'
import { useDismissed } from '@/lib/collections'
import type { Media } from '@/lib/anilist'

interface Props {
  items: Media[]
  /** Namespace for the dismissals; one per source list so they stay separate. */
  namespace?: string
  limit?: number
}

/**
 * Recommendation grid with per-card dismissal.
 *
 * A viewer who has seen a title knows better than the relation graph, so a
 * dismissal is remembered locally and the card is filtered out of this grid on
 * every later visit. Rendered client-side because it reads localStorage.
 */
export default function RecommendGrid({ items, namespace = 'reco', limit = 12 }: Props) {
  const { has, dismiss } = useDismissed(namespace)

  const visible = items.filter((m) => !has(m.id)).slice(0, limit)

  if (!visible.length) {
    return <p className="text-xs text-zinc-500">All suggestions hidden. They stay hidden on this device.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {visible.map((m) => (
        <div key={m.id} className="group/reco relative">
          <PosterCard media={m} />
          <button
            type="button"
            onClick={() => dismiss(m.id)}
            aria-label={`Hide suggestion ${m.id}`}
            title="Hide this suggestion"
            className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded border border-white/15 bg-black/70 text-zinc-300 opacity-0 backdrop-blur transition-opacity hover:text-white group-hover/reco:opacity-100 focus-visible:opacity-100"
          >
            <IconClose size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
