'use client'

import { useState } from 'react'
import { IconEye, IconEyeOff } from './icons'

interface Props {
  children: string
  className?: string
  /** Start revealed, for a viewer who has already watched. */
  initiallyRevealed?: boolean
}

/**
 * Blurs text behind a click, for synopses and episode titles.
 *
 * Blur rather than a plain overlay so the shape of the paragraph is still
 * visible and the layout does not jump when it is revealed.
 */
export default function SpoilerText({ children, className = '', initiallyRevealed = false }: Props) {
  const [revealed, setRevealed] = useState(initiallyRevealed)

  return (
    <span className={`relative inline-block w-full ${className}`}>
      <span
        className={[
          'transition-[filter,opacity] duration-300',
          revealed ? 'blur-0 opacity-100' : 'select-none blur-[6px] opacity-60',
        ].join(' ')}
        aria-hidden={!revealed}
      >
        {children}
      </span>
      {!revealed && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="absolute inset-0 flex items-center justify-center gap-1.5 rounded font-mono text-[0.65rem] uppercase tracking-wider text-zinc-300 transition-colors hover:text-accent-soft"
        >
          <IconEye size={14} />
          Spoiler — tap to reveal
        </button>
      )}
      {revealed && (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          aria-label="Hide spoiler"
          className="ml-1.5 inline-flex translate-y-[-1px] align-middle text-zinc-500 transition-colors hover:text-accent"
        >
          <IconEyeOff size={13} />
        </button>
      )}
    </span>
  )
}
