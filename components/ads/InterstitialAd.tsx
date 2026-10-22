'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import AdSlot from './AdSlot'
import { INTERSTITIAL_COOLDOWN_MS, SLOTS } from '@/config/ads'
import { adsAllowed, hydrateConsent, subscribeConsent } from '@/lib/ads/consent'
import { adsOptedOut } from '@/lib/ads/useAdsEnabled'
import { IconClose } from '../icons'

const LAST_KEY = 'crused:ads:last-interstitial'

/**
 * Routes where a modal would sit on top of something the viewer is using.
 *
 * Only the player is left: it is the one surface that owns the viewer's clicks
 * and attention, and a modal over a video is the most hostile placement there
 * is. Every other route is browsable, so an interstitial is merely annoying
 * rather than broken.
 */
const PLAYER_ROUTES = ['/watch']

/**
 * An interstitial on route change, capped to one per 60 seconds.
 *
 * The cap is the point. An interstitial on every navigation is the behaviour
 * that gets a site flagged and a viewer to install a blocker; one a minute is
 * the most that stays tolerable. The cap is enforced across tabs and reloads
 * by storing the timestamp, so a fast clicker cannot farm extra impressions
 * either.
 *
 * It never appears on the watch route, and never on the first paint — only on
 * a client-side navigation, which means the viewer is already engaged.
 */
export default function InterstitialAd() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const firstRender = useRef(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    hydrateConsent()
    const sync = () => setAllowed(adsAllowed())
    sync()
    return subscribeConsent(sync)
  }, [])

  useEffect(() => {
    // The first render is a page load, not a navigation. Skip it.
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (!allowed || adsOptedOut()) return
    // The player is excluded. An interstitial over a video is the single most
    // hostile placement there is: the viewer came to watch, and a modal that
    // eats their first click is a bug, not an ad.
    if (PLAYER_ROUTES.some((r) => pathname.startsWith(r))) return

    let last = 0
    try {
      last = Number(localStorage.getItem(LAST_KEY) ?? 0)
    } catch {
      /* ignore */
    }
    if (Date.now() - last < INTERSTITIAL_COOLDOWN_MS) return

    const t = window.setTimeout(() => {
      setOpen(true)
      try {
        localStorage.setItem(LAST_KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
    }, 900)
    return () => window.clearTimeout(t)
  }, [allowed, pathname])

  if (!open) return null

  return (
    <div className="ad-interstitial" role="dialog" aria-modal="true" aria-label="Advertisement">
      <div className="ad-interstitial__panel">
        <button
          type="button"
          className="ad-interstitial__close"
          aria-label="Close advertisement"
          onClick={() => setOpen(false)}
        >
          <IconClose size={16} />
        </button>
        <AdSlot slot="interstitial" size={SLOTS.interstitial.size} />
        <button type="button" className="ad-interstitial__skip" onClick={() => setOpen(false)}>
          Continue to page
        </button>
      </div>
    </div>
  )
}
