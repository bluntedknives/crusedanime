'use client'

import { useEffect, useRef, useState } from 'react'
import { IconShare, IconStar, IconCheck } from '@/components/icons'
import { useRatings } from '@/lib/store'

/**
 * Share the current page.
 *
 * Prefers the native share sheet where it exists (mobile, and Safari desktop)
 * and falls back to the clipboard, then to a prompt with the URL selected so
 * the link is still recoverable on a browser that blocks both.
 */
export function ShareButton({ title, className = '' }: { title: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const flash = (next: 'copied' | 'failed') => {
    setState(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2200)
  }

  const onClick = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // The user dismissed the sheet, or sharing is blocked. Falling through
        // to the clipboard is still the right move — a cancel should not need a
        // second click.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      flash('copied')
    } catch {
      flash('failed')
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-ghost gap-1.5 text-xs ${className}`}
      aria-label={`Share ${title}`}
    >
      {state === 'copied' ? <IconCheck size={15} /> : <IconShare size={15} />}
      {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy failed' : 'Share'}
    </button>
  )
}

/**
 * Personal 1–10 score.
 *
 * Distinct from the AniList community score shown elsewhere on the page: this
 * is only ever stored locally, and is never sent anywhere.
 */
export function RatingWidget({ animeId, title }: { animeId: number; title: string }) {
  const { get, set } = useRatings()
  const current = get(animeId)
  const [hover, setHover] = useState<number | null>(null)

  const shown = hover ?? current ?? 0

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="label mb-0">Your rating</span>
      <div
        className="flex items-center gap-0.5"
        role="radiogroup"
        aria-label={`Your rating for ${title}`}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            aria-label={`Rate ${n} out of 10`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => set(animeId, current === n ? null : n)}
            className="p-0.5"
          >
            <IconStar
              size={18}
              className={
                n <= shown
                  ? 'text-signal transition-transform hover:scale-110'
                  : 'text-zinc-700 transition-colors hover:text-zinc-500'
              }
            />
          </button>
        ))}
      </div>
      <span className="w-12 text-sm tabular-nums text-zinc-400">
        {current != null ? `${current}/10` : '—'}
      </span>
      {current != null && (
        <button
          type="button"
          onClick={() => set(animeId, null)}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  )
}
