'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { IconChevronLeft, IconChevronRight } from './icons'
import PosterCard from './PosterCard'
import type { Media } from '@/lib/anilist'

interface Props {
  title: string
  /** Small label above the title, e.g. "This season". */
  eyebrow?: string
  items: Media[]
  href?: string
  /** Episode counts keyed by anime id, used for progress bars. */
  watched?: Record<number, number>
}

export default function MediaRail({ title, eyebrow, items, href, watched = {} }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    setAtStart(el.scrollLeft < 8)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8)
  }

  const nudge = (dir: -1 | 1) => {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: 'smooth' })
  }

  if (!items.length) return null

  return (
    <section className="animate-fade-up">
      <div className="container-page">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            <h2 className="rail-title">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {href && (
              <Link
                href={href}
                className="mr-1 font-mono text-[0.65rem] uppercase tracking-wider text-zinc-500 transition-colors hover:text-accent"
              >
                View all
              </Link>
            )}
            <button
              type="button"
              onClick={() => nudge(-1)}
              disabled={atStart}
              aria-label="Scroll left"
              className="btn-icon h-8 w-8 border border-white/[0.08] disabled:opacity-25"
            >
              <IconChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              disabled={atEnd}
              aria-label="Scroll right"
              className="btn-icon h-8 w-8 border border-white/[0.08] disabled:opacity-25"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="scrollbar-none flex gap-3 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8"
      >
        {items.map((m) => (
          <PosterCard
            key={m.id}
            media={m}
            watchedEpisodes={watched[m.id] ?? 0}
            className="w-[136px] shrink-0 sm:w-[152px]"
          />
        ))}
      </div>
    </section>
  )
}
