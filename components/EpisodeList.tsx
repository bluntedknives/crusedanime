'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { EpisodeInfo } from '@/lib/consumet'
import { formatTime, type ProgressEntry } from '@/lib/store'

type Layout = 'grid' | 'list'

interface Props {
  animeId: number
  episodes: EpisodeInfo[]
  progress?: ProgressEntry | null
  /** Which audio track the links should point at. */
  type?: 'sub' | 'dub'
  loading?: boolean
  /** Message shown when the provider has no episodes (e.g. unaired). */
  emptyMessage?: string
  defaultLayout?: Layout
  maxHeight?: string
}

function EpisodeRow({
  animeId,
  ep,
  type,
  progress,
  compact,
}: {
  animeId: number
  ep: EpisodeInfo
  type: 'sub' | 'dub'
  progress?: ProgressEntry | null
  compact?: boolean
}) {
  const isCurrent = progress?.episode === ep.number
  const watched = progress ? ep.number < progress.episode || (isCurrent && progress.duration > 0 && progress.position / progress.duration > 0.9) : false
  const pct =
    isCurrent && progress?.duration
      ? Math.min(100, (progress.position / progress.duration) * 100)
      : 0

  return (
    <Link
      href={`/watch/${animeId}/${ep.number}${type === 'dub' ? '?type=dub' : ''}`}
      className={[
        'group relative flex items-center gap-3 rounded-lg border p-2.5 transition',
        isCurrent
          ? 'border-brand/60 bg-brand/10'
          : 'border-white/5 bg-ink-850/60 hover:border-white/15 hover:bg-ink-800',
      ].join(' ')}
    >
      <span
        className={[
          'grid shrink-0 place-items-center rounded-md text-xs font-semibold',
          compact ? 'h-8 w-8' : 'h-9 w-9',
          watched ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-zinc-300',
        ].join(' ')}
      >
        {watched ? '✓' : ep.number}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={[
            'block truncate text-[13px] font-medium',
            isCurrent ? 'text-brand-soft' : 'text-zinc-100',
          ].join(' ')}
        >
          {ep.title?.trim() ? `EP ${ep.number} · ${ep.title}` : `Episode ${ep.number}`}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
          {ep.hasSub && <span className="text-zinc-400">SUB</span>}
          {ep.hasDub && <span className="text-zinc-400">DUB</span>}
          {ep.filler && (
            <span className="rounded bg-amber-500/15 px-1 py-px text-amber-300">filler</span>
          )}
        </span>

        {pct > 0 && (
          <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-white/10">
            <span className="block h-full bg-brand" style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>

      <span className="shrink-0 text-zinc-500 transition group-hover:text-brand-soft">
        {isCurrent ? (
          <span className="text-[11px] font-semibold text-brand-soft">
            {progress?.duration ? formatTime(progress.position) : 'Resume'}
          </span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </span>
    </Link>
  )
}

export default function EpisodeList({
  animeId,
  episodes,
  progress,
  type = 'sub',
  loading,
  emptyMessage = 'No episodes available from the provider yet.',
  defaultLayout = 'list',
  maxHeight,
}: Props) {
  const [layout, setLayout] = useState<Layout>(defaultLayout)
  const [reversed, setReversed] = useState(false)
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<'all' | '50' | '100'>('all')

  const filtered = useMemo(() => {
    let list = episodes
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (e) => String(e.number).includes(q) || (e.title ?? '').toLowerCase().includes(q),
      )
    }
    if (range !== 'all') list = list.slice(0, Number(range))
    return reversed ? [...list].reverse() : list
  }, [episodes, query, range, reversed])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-full" />
        ))}
      </div>
    )
  }

  if (!episodes.length) {
    return (
      <div className="surface p-6 text-center text-sm text-zinc-400">
        {emptyMessage}
      </div>
    )
  }

  const watchedCount = progress ? Math.max(0, progress.episode - 1) : 0

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[140px] flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find episode…"
            className="input py-2 text-[13px]"
          />
        </div>

        <select
          value={range}
          onChange={(e) => setRange(e.target.value as 'all' | '50' | '100')}
          className="input w-auto py-2 text-[13px]"
          aria-label="Episode range"
        >
          <option value="all">All</option>
          <option value="50">First 50</option>
          <option value="100">First 100</option>
        </select>

        <button
          type="button"
          onClick={() => setReversed((v) => !v)}
          className="btn-ghost px-3 py-2 text-[13px]"
          title="Reverse order"
        >
          {reversed ? '↑ Oldest' : '↓ Newest'}
        </button>

        <div className="flex overflow-hidden rounded-lg border border-white/10">
          {(['list', 'grid'] as Layout[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLayout(l)}
              className={[
                'px-3 py-2 text-[12px] font-medium capitalize transition',
                layout === l ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5',
              ].join(' ')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          {episodes.length} episode{episodes.length === 1 ? '' : 's'}
          {watchedCount ? ` · ${watchedCount} watched` : ''}
        </span>
        <span className="uppercase tracking-wide">{type}</span>
      </div>

      <div
        className={[
          layout === 'grid' ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'space-y-2',
          'overflow-y-auto pr-1',
        ].join(' ')}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {filtered.map((ep) => (
          <EpisodeRow
            key={ep.id || ep.number}
            animeId={animeId}
            ep={ep}
            type={type}
            progress={progress}
            compact={layout === 'grid'}
          />
        ))}
        {!filtered.length && (
          <p className="py-6 text-center text-sm text-zinc-500">No episodes match “{query}”.</p>
        )}
      </div>
    </div>
  )
}
