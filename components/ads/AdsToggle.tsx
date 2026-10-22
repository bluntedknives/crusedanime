'use client'

import { useEffect, useState } from 'react'
import { adsEnabled } from '@/lib/ads/config'
import { adsOptedOut, setAdsOptOut } from '@/lib/ads/useAdsEnabled'

/**
 * The opt-out for sponsored slots.
 *
 * Present, and it actually works — the preference is read by every slot before
 * it renders. An ad that cannot be dismissed is the fastest way to make a
 * viewer leave, and an opt-out that is not honoured is worse than none.
 */
export default function AdsToggle() {
  const [off, setOff] = useState(false)

  useEffect(() => {
    setOff(adsOptedOut())
  }, [])

  if (!adsEnabled) return null

  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <p className="text-sm text-zinc-200">Show sponsored slots</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Off hides every ad on the site. Nothing else changes.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!off}
        aria-label="Show sponsored slots"
        onClick={() => {
          const next = !off
          setOff(next)
          setAdsOptOut(next)
        }}
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          !off ? 'bg-accent' : 'bg-white/15',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            !off ? 'translate-x-[1.4rem]' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
    </div>
  )
}
