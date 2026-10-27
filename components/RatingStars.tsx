'use client'

import { useState } from 'react'

interface Props {
  /** Current rating 1–10, or null when unrated. */
  value: number | null
  onChange: (score: number | null) => void
  /** Read-only display, for list rows. */
  readOnly?: boolean
  size?: number
  className?: string
}

/**
 * Ten-point rating control rendered as five stars, so a half star is a real
 * value rather than a rounding artefact. Clicking the same star again clears
 * the rating, which is the only way back to "unrated" without a separate
 * button.
 */
export default function RatingStars({ value, onChange, readOnly = false, size = 22, className = '' }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0

  if (readOnly) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={value ? `Rated ${value} of 10` : 'Not rated'}>
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.max(0, Math.min(1, shown / 2 - (star - 1)))
          return <Star key={star} size={size} fill={fill} />
        })}
      </span>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="radiogroup"
      aria-label="Your rating"
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className="flex">
          {/* Two hit targets per star: the left half scores the odd point, the
              right half the even one, so all ten values are reachable. */}
          <button
            type="button"
            aria-label={`Rate ${star * 2 - 1} of 10`}
            onMouseEnter={() => setHover(star * 2 - 1)}
            onClick={() => onChange(value === star * 2 - 1 ? null : star * 2 - 1)}
            className="p-0.5"
          >
            <Star size={size} fill={Math.max(0, Math.min(1, shown / 2 - (star - 1)))} half />
          </button>
          <button
            type="button"
            aria-label={`Rate ${star * 2} of 10`}
            onMouseEnter={() => setHover(star * 2)}
            onClick={() => onChange(value === star * 2 ? null : star * 2)}
            className="p-0.5"
          >
            <Star size={size} fill={Math.max(0, Math.min(1, shown / 2 - (star - 1)))} />
          </button>
        </span>
      ))}
      <span className="ml-2 font-mono text-xs tabular-nums text-zinc-400">
        {shown > 0 ? `${shown}/10` : '—'}
      </span>
    </div>
  )
}

/** A star whose fill fraction is drawn by clipping a solid star over a hollow one. */
function Star({ size, fill, half = false }: { size: number; fill: number; half?: boolean }) {
  const clamped = Math.max(0, Math.min(1, fill))
  const id = `star-${size}-${Math.round(clamped * 100)}-${half ? 'h' : 'f'}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${clamped * 100}%`} stopColor="#c8a44d" />
          <stop offset={`${clamped * 100}%`} stopColor="rgba(255,255,255,0.14)" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.7l6.1-.9L12 3.2Z"
        fill={`url(#${id})`}
        stroke="rgba(200,164,77,0.5)"
        strokeWidth="1"
      />
    </svg>
  )
}
