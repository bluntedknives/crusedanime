'use client'

import { useEffect, useState } from 'react'
import AdSlot from './AdSlot'
import { SLOTS } from '@/config/ads'
import { IconClose } from '../icons'

const DISMISS_KEY = 'crused:ads:anchor-dismissed'

/**
 * The sticky bottom bar — the highest-RPM placement on the site.
 *
 * Two rules it must not break. It loads after first paint, so it never competes
 * with LCP; and it is dismissible, permanently, in one click. A bar that cannot
 * be closed is the fastest way to lose a viewer, and a lost viewer is worth
 * less than any impression.
 *
 * It is hidden on the watch route: nothing sits under the player.
 */
export default function AnchorAd() {
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    // Mount only after the page has painted and the browser is idle.
    const go = () => {
      const off = localStorage.getItem(DISMISS_KEY) === '1'
      setDismissed(off)
      setReady(true)
    }
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(go, { timeout: 3000 })
    } else {
      window.setTimeout(go, 1200)
    }
  }, [])

  if (!ready || dismissed) return null

  return (
    <div className="ad-anchor" role="complementary" aria-label="Advertisement">
      <button
        type="button"
        aria-label="Close advertisement"
        className="ad-anchor__close"
        onClick={() => {
          setDismissed(true)
          try {
            localStorage.setItem(DISMISS_KEY, '1')
          } catch {
            /* ignore */
          }
        }}
      >
        <IconClose size={14} />
      </button>
      <AdSlot slot="anchor" size={SLOTS.anchor.size} />
    </div>
  )
}
