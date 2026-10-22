'use client'

import { useEffect, useState } from 'react'
import { IconClose } from '../icons'

const SEEN_KEY = 'crused:ads:adblock-prompt'

/**
 * A polite note when a blocker is detected. Shown at most once a day, and it
 * never blocks content.
 *
 * The detection is deliberately conservative: a bait element with the class
 * names blockers target, checked for a computed height of zero. It produces the
 * occasional false positive on aggressive content blockers, which is exactly
 * why the prompt is dismissible and non-blocking rather than a wall.
 */
export default function AdBlockPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let last = 0
    try {
      last = Number(localStorage.getItem(SEEN_KEY) ?? 0)
    } catch {
      /* ignore */
    }
    if (Date.now() - last < 24 * 60 * 60 * 1000) return

    const bait = document.createElement('div')
    bait.className = 'adsbox ad-banner adsbygoogle text-ad advertisement'
    bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;'
    bait.innerHTML = '&nbsp;'
    document.body.appendChild(bait)

    // Give the blocker a frame to act on it.
    const t = window.setTimeout(() => {
      const blocked =
        bait.offsetHeight === 0 ||
        bait.clientHeight === 0 ||
        getComputedStyle(bait).display === 'none' ||
        getComputedStyle(bait).visibility === 'hidden'
      bait.remove()
      if (blocked) {
        setShow(true)
        try {
          localStorage.setItem(SEEN_KEY, String(Date.now()))
        } catch {
          /* ignore */
        }
      }
    }, 600)

    return () => {
      window.clearTimeout(t)
      bait.remove()
    }
  }, [])

  if (!show) return null

  return (
    <div className="ad-block-note" role="status">
      <p className="ad-block-note__text">
        Looks like an ad blocker is on. That is your call and everything still works — the site
        just runs on the slots you would be seeing.
      </p>
      <button
        type="button"
        className="ad-block-note__close"
        aria-label="Dismiss"
        onClick={() => setShow(false)}
      >
        <IconClose size={14} />
      </button>
    </div>
  )
}
