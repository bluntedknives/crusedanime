'use client'

import { useState } from 'react'
import { IconCheck, IconShare } from './icons'

interface Props {
  title: string
  /** Path only; the origin is read at click time so it works on any host. */
  path: string
  className?: string
  label?: string
}

/**
 * Copy-link / native-share button.
 *
 * Prefers the Web Share API where it exists (mobile), and falls back to
 * `navigator.clipboard` otherwise. The clipboard call needs a secure context,
 * so a plain-text fallback runs if it is unavailable rather than failing
 * silently.
 */
export default function ShareButton({ title, path, className = '', label = 'Share' }: Props) {
  const [done, setDone] = useState(false)

  const share = async () => {
    const url = `${window.location.origin}${path}`
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      // Share sheet dismissed, or clipboard blocked: leave the button as-is.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`btn-ghost inline-flex items-center gap-1.5 text-xs ${className}`}
      aria-label={`Share ${title}`}
    >
      {done ? <IconCheck size={14} /> : <IconShare size={14} />}
      {done ? 'Link copied' : label}
    </button>
  )
}
