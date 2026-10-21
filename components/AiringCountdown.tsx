'use client'

import { useEffect, useState } from 'react'
import { formatCountdown } from '@/lib/anilist'

interface Props {
  /** Unix seconds at which the episode airs. */
  airingAt: number
  episode?: number | null
  className?: string
  /** Rendered before the countdown text, e.g. "EP 12 in ". */
  prefix?: string
  compact?: boolean
}

function timeUntil(airingAt: number): number {
  return Math.max(0, airingAt - Math.floor(Date.now() / 1000))
}

/**
 * Deterministic timestamp for the tooltip. `toLocaleString` renders in the
 * server's zone at SSR and the visitor's zone on hydration, which is a text
 * mismatch; ISO is the same everywhere.
 */
function utcStamp(airingAt: number): string {
  return new Date(airingAt * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

export default function AiringCountdown({
  airingAt,
  episode,
  className = '',
  prefix,
  compact = false,
}: Props) {
  // Starts null so the server and the first client render agree: computing the
  // countdown during render would read the clock at two different instants and
  // mismatch on hydration.
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    setRemaining(timeUntil(airingAt))
    const id = setInterval(() => setRemaining(timeUntil(airingAt)), 1000)
    return () => clearInterval(id)
  }, [airingAt])

  const known = remaining !== null
  const aired = known && remaining <= 0
  const text = prefix ?? (episode ? `EP ${episode} in ` : '')
  const soon = known && remaining > 0 && remaining < 3600

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums',
        aired
          ? 'bg-white/5 text-zinc-400'
          : soon
            ? 'bg-amber-500/15 text-amber-300'
            : 'bg-emerald-500/12 text-emerald-300',
        compact ? 'px-1.5 py-0' : '',
        className,
      ].join(' ')}
      title={utcStamp(airingAt)}
    >
      {known && !aired && (
        <span className={['h-1.5 w-1.5 rounded-full', soon ? 'bg-amber-400' : 'bg-emerald-400'].join(' ')} />
      )}
      {!known ? '—' : aired ? 'Aired' : `${text}${formatCountdown(remaining)}`}
    </span>
  )
}
