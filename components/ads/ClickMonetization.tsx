'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  armClickAd,
  fireClickAd,
  notePress,
  type ClickAdOutcome,
} from '@/lib/ads/clickMonetization'
import { recordImpression, recordRequest, recordSkip } from '@/lib/ads/telemetry'

/**
 * Turns any click on the page into a Smartlink open, rate limited.
 *
 * Mounted once in the root layout. It renders nothing — the whole component is
 * the listener — because the point is to cover the entire viewport rather than
 * a box the viewer has to find.
 *
 * Capture phase, and not passive: this has to see the click before whatever the
 * viewer actually clicked on, so that navigation happens *after* the open is
 * requested. The popup permission is tied to that moment, and losing the race
 * means the open is silently blocked.
 *
 * Nothing here calls preventDefault. The viewer's click always does what it
 * looked like it would do; the ad opens alongside it. That is the difference
 * between a monetised page and a broken one.
 */
export default function ClickMonetization() {
  const pathname = usePathname()

  // The arm delay is measured from mount, so a click during hydration — which
  // is usually the viewer dismissing something or grabbing a scrollbar — is
  // never the one that fires.
  useEffect(() => {
    armClickAd()
  }, [])

  useEffect(() => {
    // The press position is what tells a click from a drag; a `click` event
    // carries no history of where the gesture started.
    const onPointerDown = (e: PointerEvent) => notePress(e.clientX, e.clientY)

    const onClick = (e: MouseEvent) => {
      const outcome = fireClickAd({
        pathname,
        target: e.target,
        button: e.button,
        modifiers: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey,
        clientX: e.clientX,
        clientY: e.clientY,
      })

      if (outcome === 'fired') {
        recordRequest('click-anywhere')
        recordImpression('click-anywhere', 'smartlink')
        return
      }
      recordSkip('click-anywhere', outcome as ClickAdOutcome)
    }

    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    document.addEventListener('click', onClick, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
      document.removeEventListener('click', onClick, { capture: true })
    }
  }, [pathname])

  return null
}
