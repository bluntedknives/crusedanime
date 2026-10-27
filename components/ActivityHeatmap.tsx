'use client'

import { useMemo, useState } from 'react'
import { useHistory } from '@/lib/store'

interface Props {
  /** How many days back to show. 182 = ~26 weeks. */
  days?: number
}

/**
 * GitHub-style contribution grid of episodes watched per day.
 *
 * Reads history rather than progress because history is one row per playback
 * event, which is what "activity" means here — progress only remembers the
 * latest position per episode, so rewatching would not register.
 */
export default function ActivityHeatmap({ days = 182 }: Props) {
  const { entries } = useHistory()
  const [hover, setHover] = useState<{ key: string; count: number } | null>(null)

  const { weeks, monthLabels, max } = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of entries) {
      const d = new Date(e.watchedAt)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }

    // Walk back from today, aligned so each column starts on a Sunday.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() - (days - 1))
    start.setDate(start.getDate() - start.getDay())

    const cols: { key: string; date: Date; count: number; future: boolean }[][] = []
    const labels: { col: number; label: string }[] = []
    let lastMonth = -1
    let cursor = new Date(start)

    while (cursor <= today) {
      const col: { key: string; date: Date; count: number; future: boolean }[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(cursor)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        col.push({ key, date, count: counts.get(key) ?? 0, future: date > today })
        cursor.setDate(cursor.getDate() + 1)
      }
      if (col[0].date.getMonth() !== lastMonth) {
        lastMonth = col[0].date.getMonth()
        labels.push({ col: cols.length, label: col[0].date.toLocaleString('en', { month: 'short' }) })
      }
      cols.push(col)
    }

    return { weeks: cols, monthLabels: labels, max: Math.max(1, ...counts.values()) }
  }, [entries, days])

  const level = (n: number) => {
    if (n === 0) return 0
    const ratio = n / max
    if (ratio > 0.75) return 4
    if (ratio > 0.5) return 3
    if (ratio > 0.25) return 2
    return 1
  }

  const TONE = [
    'bg-white/[0.04]',
    'bg-accent/25',
    'bg-accent/45',
    'bg-accent/70',
    'bg-accent',
  ]

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs text-zinc-400">
          {hover
            ? `${hover.count} episode${hover.count === 1 ? '' : 's'} on ${hover.key}`
            : 'Episodes watched per day'}
        </p>
        <span className="flex items-center gap-1 font-mono text-[0.6rem] text-zinc-600">
          Less
          {TONE.map((t, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${t}`} />
          ))}
          More
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-max">
          <div className="mb-1 flex gap-[3px] pl-0">
            {weeks.map((_, i) => {
              const label = monthLabels.find((m) => m.col === i)
              return (
                <span key={i} className="w-[11px] font-mono text-[0.55rem] text-zinc-600">
                  {label ? label.label : ''}
                </span>
              )
            })}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((day) => (
                  <span
                    key={day.key}
                    onMouseEnter={() => !day.future && setHover({ key: day.key, count: day.count })}
                    onMouseLeave={() => setHover(null)}
                    title={day.future ? undefined : `${day.key}: ${day.count} episode(s)`}
                    className={[
                      'h-[11px] w-[11px] rounded-[2px] transition-colors',
                      day.future ? 'bg-transparent' : TONE[level(day.count)],
                    ].join(' ')}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
