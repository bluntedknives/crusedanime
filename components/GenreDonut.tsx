'use client'

import { useState } from 'react'
import type { GenreSlice } from '@/lib/store'

interface Props {
  slices: GenreSlice[]
  /** How many arcs to draw; the rest fold into "Other". */
  limit?: number
  size?: number
}

/**
 * Genre breakdown as a donut.
 *
 * A ring rather than a pie because the hole gives the total a natural home, and
 * because arcs of similar size are easier to compare along a constant-radius
 * edge than from a centre. Hovering isolates one arc.
 */
const PALETTE = ['#c8a44d', '#4cc9a0', '#8b7fd4', '#d4795a', '#5aa8d4', '#c45a8e', '#7fbf5a', '#bf9f5a']

export default function GenreDonut({ slices, limit = 7, size = 200 }: Props) {
  const [active, setActive] = useState<number | null>(null)

  const top = slices.slice(0, limit)
  const restMinutes = slices.slice(limit).reduce((n, s) => n + s.minutes, 0)
  const totalMinutes = slices.reduce((n, s) => n + s.minutes, 0)

  const parts = [...top]
  if (restMinutes > 0) {
    parts.push({
      genre: 'Other',
      episodes: slices.slice(limit).reduce((n, s) => n + s.episodes, 0),
      minutes: restMinutes,
      share: totalMinutes > 0 ? restMinutes / totalMinutes : 0,
    })
  }

  if (!parts.length || totalMinutes <= 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No genre data yet.</p>
  }

  const r = size / 2 - 14
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  // Precompute each arc's offset so the hover state can dim the others without
  // recomputing the running total mid-render.
  let cursor = 0
  const arcs = parts.map((p, i) => {
    const frac = totalMinutes > 0 ? p.minutes / totalMinutes : 0
    const arc = { ...p, frac, offset: cursor, color: PALETTE[i % PALETTE.length] }
    cursor += frac
    return arc
  })

  const shown = active != null ? arcs[active] : null

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label="Watch time by genre">
          {arcs.map((a, i) => (
            <circle
              key={a.genre}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={active === i ? 22 : 16}
              strokeDasharray={`${a.frac * circumference} ${circumference}`}
              strokeDashoffset={-a.offset * circumference}
              className="cursor-pointer transition-[stroke-width,opacity] duration-200"
              opacity={active == null || active === i ? 1 : 0.25}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          {shown ? (
            <>
              <p className="font-mono text-lg font-semibold tabular-nums text-zinc-100">
                {Math.round(shown.frac * 100)}%
              </p>
              <p className="max-w-[6.5rem] truncate text-[0.68rem] text-zinc-400">{shown.genre}</p>
            </>
          ) : (
            <>
              <p className="font-mono text-lg font-semibold tabular-nums text-zinc-100">
                {Math.round(totalMinutes / 60)}h
              </p>
              <p className="text-[0.68rem] text-zinc-500">watched</p>
            </>
          )}
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1">
        {arcs.map((a, i) => (
          <li
            key={a.genre}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={[
              'flex items-center gap-2.5 rounded px-2 py-1 text-xs transition-colors',
              active === i ? 'bg-white/[0.05]' : '',
            ].join(' ')}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: a.color }} />
            <span className="min-w-0 flex-1 truncate text-zinc-300">{a.genre}</span>
            <span className="shrink-0 font-mono tabular-nums text-zinc-500">
              {Math.round(a.minutes / 60)}h
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
