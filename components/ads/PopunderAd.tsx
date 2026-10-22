'use client'

import { useEffect } from 'react'
import { SLOTS } from '@/config/ads'
import { runWaterfall } from '@/lib/ads/waterfall'
import { ADS } from '@/lib/ads/config'
import { adsAllowed, hydrateConsent, subscribeConsent } from '@/lib/ads/consent'
import { adsOptedOut } from '@/lib/ads/useAdsEnabled'
import { CLICK_AD_ENABLED } from '@/lib/ads/clickMonetization'
import { recordAttempts, recordImpression, recordRequest } from '@/lib/ads/telemetry'

const SESSION_KEY = 'crused:ads:popunder-fired'

/**
 * One popunder per session, and only ever on a deliberate gesture.
 *
 * Browsers block popups that are not opened from a real user action, so firing
 * this on load would simply fail — and trying to work around that would be both
 * futile and hostile. Instead the first click anywhere on the page triggers it,
 * once, and the session flag stops it recurring even across navigations.
 *
 * Popunders have no house fallback: there is no visible element to fill, so a
 * house box would be meaningless.
 */
export default function PopunderAd() {
  useEffect(() => {
    let allowed = false
    let armed = true

    const sync = () => {
      allowed = adsAllowed()
    }
    hydrateConsent()
    sync()
    const unsub = subscribeConsent(sync)

    if (sessionStorage.getItem(SESSION_KEY) === '1') armed = false

    // Click-anywhere supersedes this. Both open the same Smartlink on a user
    // gesture, so running them together means one click opens two tabs — the
    // popunder on the pointerdown and the click ad on the click that follows.
    // Click-anywhere is the better of the two (rate limited, route aware), so
    // this stands down while it is on and remains available if it is switched
    // off with NEXT_PUBLIC_ADS_CLICK_ANYWHERE=0.
    if (CLICK_AD_ENABLED && ADS.smartlink) armed = false

    const onClick = () => {
      if (!armed || !allowed || adsOptedOut()) return
      armed = false
      sessionStorage.setItem(SESSION_KEY, '1')

      const holder = document.createElement('div')
      holder.style.display = 'none'
      document.body.appendChild(holder)
      recordRequest('popunder')
      void runWaterfall(
        holder,
        { slot: 'popunder', format: 'popunder', size: SLOTS.popunder.size, consent: allowed, visible: true },
        SLOTS.popunder.chain,
      ).then((r) => {
        recordAttempts('popunder', r.attempts, r.servedBy)
        if (r.filled) recordImpression('popunder', r.servedBy)
        holder.remove()
      })
    }

    // `once: true` on the capture phase: the very first gesture anywhere.
    window.addEventListener('pointerdown', onClick, { once: true, capture: true })
    return () => {
      unsub()
      window.removeEventListener('pointerdown', onClick, { capture: true })
    }
  }, [])

  return null
}
