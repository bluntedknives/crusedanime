'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Two-key navigation shortcuts, in the style of a `g` prefix.
 *
 * The prefix is armed for a moment and then dropped, so a stray `g` while
 * reading does nothing and the pair must be pressed deliberately. Ignored while
 * typing, and while any modifier is held, so it never fights the browser.
 */
const DESTINATIONS: Record<string, string> = {
  h: '/',
  b: '/search',
  t: '/trending',
  s: '/schedule',
  u: '/upnext',
  w: '/watchlist',
  r: '/ratings',
  y: '/history',
  a: '/stats',
  g: '/genres',
}

/** How long the prefix stays armed, in ms. */
const ARM_MS = 1200

export default function GlobalShortcuts() {
  const router = useRouter()
  const armedAt = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return

      const now = Date.now()
      if (e.key === 'g') {
        armedAt.current = now
        return
      }

      if (now - armedAt.current <= ARM_MS) {
        const href = DESTINATIONS[e.key.toLowerCase()]
        if (href) {
          e.preventDefault()
          armedAt.current = 0
          router.push(href)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  return null
}
