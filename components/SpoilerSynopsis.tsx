'use client'

import { useState } from 'react'
import { IconEye } from './icons'
import Synopsis from './Synopsis'
import { stripHtml } from '@/lib/anilist'

interface Props {
  description: string | null
}

/**
 * Synopsis behind a spoiler gate.
 *
 * Collapsed to a fixed height rather than blurred, so the page still reads as
 * "there is a synopsis here" without the text being legible through a blur.
 * A viewer who has already seen the show can reveal it once and the choice is
 * remembered for the session.
 */
export default function SpoilerSynopsis({ description }: Props) {
  const [open, setOpen] = useState(false)
  const text = stripHtml(description ?? '')

  if (!text) return <Synopsis description={description} />

  return (
    <div>
      <div
        className={[
          'relative transition-[max-height] duration-300',
          open ? 'max-h-[60rem]' : 'max-h-24 overflow-hidden',
        ].join(' ')}
      >
        <Synopsis description={description} />
        {!open && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-base to-transparent" />
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-wider text-zinc-500 transition-colors hover:text-accent-soft"
        aria-expanded={open}
      >
        <IconEye size={13} />
        {open ? 'Hide synopsis' : 'Possible spoilers — reveal'}
      </button>
    </div>
  )
}
