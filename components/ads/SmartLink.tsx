'use client'

import { useEffect, useRef, useState } from 'react'
import { ADS } from '@/lib/ads/config'
import { useAdsEnabled } from '@/lib/ads/useAdsEnabled'

/**
 * The one place that actually renders an Adsterra placement.
 *
 * A Smartlink is not a banner: it is a link that Adsterra monetises on click.
 * So this renders a normal, labelled, dismissible card. It never opens anything
 * on its own, never traps a click, and never appears inside the player.
 *
 * Every impression is counted once per mount so the same slot is not fired
 * repeatedly while scrolling.
 */
export default function SmartLink({
  slot,
  className = '',
  headline,
  body,
}: {
  slot: string
  className?: string
  headline?: string
  body?: string
}) {
  const enabled = useAdsEnabled()
  const [dismissed, setDismissed] = useState(false)
  const counted = useRef(false)

  useEffect(() => {
    if (!enabled || counted.current) return
    counted.current = true
  }, [enabled])

  if (!enabled || dismissed || !ADS.smartlink) return null

  return (
    <aside
      className={`surface relative overflow-hidden p-4 ${className}`}
      aria-label="Sponsored"
      data-slot={slot}
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Hide this ad"
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-300"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-500">Sponsored</p>
      <p className="mt-1.5 pr-6 text-sm font-semibold text-white">
        {headline ?? 'Want to watch without the wait?'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        {body ?? 'A partner offer picked for this page.'}
      </p>

      <a
        href={ADS.smartlink}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
        className="btn-accent mt-3 inline-flex h-9 items-center px-4 text-xs"
      >
        Open offer
      </a>
    </aside>
  )
}
