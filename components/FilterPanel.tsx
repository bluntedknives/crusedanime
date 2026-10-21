'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export interface Filters {
  genres: string[]
  year: string
  season: string
  format: string
  status: string
  scoreMin: number
  studio: string
  sort: string
}

export const EMPTY_FILTERS: Filters = {
  genres: [],
  year: '',
  season: '',
  format: '',
  status: '',
  scoreMin: 0,
  studio: '',
  sort: '',
}

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
const FORMATS = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC']
const STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS']
const SORTS = [
  { value: 'POPULARITY_DESC', label: 'Most popular' },
  { value: 'SCORE_DESC', label: 'Highest rated' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'START_DATE_DESC', label: 'Newest' },
  { value: 'START_DATE_ASC', label: 'Oldest' },
  { value: 'TITLE_ROMAJI', label: 'Title A–Z' },
  { value: 'FAVOURITES_DESC', label: 'Most favourited' },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 66 }, (_, i) => CURRENT_YEAR + 2 - i)

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  /** Total results currently rendered, shown in the header. */
  resultCount?: number
  loading?: boolean
}

export default function FilterPanel({ filters, onChange, resultCount, loading }: Props) {
  const [genres, setGenres] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [studioHits, setStudioHits] = useState<{ id: number; name: string }[]>([])
  const [studioOpen, setStudioOpen] = useState(false)

  useEffect(() => {
    fetch('/api/anilist?action=genres')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((d: { genres?: string[] }) => setGenres(d.genres ?? []))
      .catch(() => setGenres([]))
  }, [])

  // Debounced studio lookup so the field behaves like an autocomplete.
  useEffect(() => {
    const term = filters.studio.trim()
    if (term.length < 2) {
      setStudioHits([])
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/anilist?action=studios&q=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
        .then((d: { studios?: { id: number; name: string }[] }) => setStudioHits(d.studios ?? []))
        .catch(() => setStudioHits([]))
    }, 350)
    return () => clearTimeout(t)
  }, [filters.studio])

  const patch = useCallback(
    (p: Partial<Filters>) => onChange({ ...filters, ...p }),
    [filters, onChange],
  )

  const toggleGenre = useCallback(
    (g: string) => {
      const next = filters.genres.includes(g)
        ? filters.genres.filter((x) => x !== g)
        : [...filters.genres, g]
      patch({ genres: next })
    },
    [filters.genres, patch],
  )

  const activeCount = useMemo(() => {
    let n = 0
    if (filters.genres.length) n += filters.genres.length
    if (filters.year) n++
    if (filters.season) n++
    if (filters.format) n++
    if (filters.status) n++
    if (filters.scoreMin > 0) n++
    if (filters.studio.trim()) n++
    if (filters.sort) n++
    return n
  }, [filters])

  const body = (
    <div className="space-y-5">
      <div>
        <span className="label">Sort by</span>
        <select
          value={filters.sort}
          onChange={(e) => patch({ sort: e.target.value })}
          className="input"
        >
          <option value="">Relevance / popular</option>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">Format</span>
          <select
            value={filters.format}
            onChange={(e) => patch({ format: e.target.value })}
            className="input"
          >
            <option value="">Any</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Status</span>
          <select
            value={filters.status}
            onChange={(e) => patch({ status: e.target.value })}
            className="input"
          >
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">Year</span>
          <select
            value={filters.year}
            onChange={(e) => patch({ year: e.target.value })}
            className="input"
          >
            <option value="">Any</option>
            {YEARS.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Season</span>
          <select
            value={filters.season}
            onChange={(e) => patch({ season: e.target.value })}
            className="input"
          >
            <option value="">Any</option>
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="label">
          Minimum score · {filters.scoreMin > 0 ? `${filters.scoreMin}%` : 'any'}
        </span>
        <input
          type="range"
          min={0}
          max={95}
          step={5}
          value={filters.scoreMin}
          onChange={(e) => patch({ scoreMin: Number(e.target.value) })}
          className="w-full accent-brand"
        />
        <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
          <span>Any</span>
          <span>50</span>
          <span>95</span>
        </div>
      </div>

      <div className="relative">
        <span className="label">Studio</span>
        <input
          value={filters.studio}
          onChange={(e) => {
            patch({ studio: e.target.value })
            setStudioOpen(true)
          }}
          onFocus={() => setStudioOpen(true)}
          onBlur={() => setTimeout(() => setStudioOpen(false), 150)}
          placeholder="e.g. MAPPA, ufotable"
          className="input"
        />
        {studioOpen && studioHits.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-auto rounded-lg border border-white/10 bg-ink-850 shadow-xl">
            {studioHits.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  patch({ studio: s.name })
                  setStudioOpen(false)
                }}
                className="block w-full px-3 py-2 text-left text-[13px] text-zinc-200 hover:bg-white/10"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <span className="label">Genres {filters.genres.length ? `(${filters.genres.length})` : ''}</span>
        <div className="max-h-64 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => {
              const active = filters.genres.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className={['chip transition', active ? 'chip-active' : 'hover:bg-white/10'].join(' ')}
                >
                  {g}
                </button>
              )
            })}
            {!genres.length && <span className="text-xs text-zinc-500">Loading genres…</span>}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...EMPTY_FILTERS })}
        disabled={activeCount === 0}
        className="btn-ghost w-full"
      >
        Clear all filters{activeCount ? ` (${activeCount})` : ''}
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile: collapsible */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-ghost w-full justify-between"
        >
          <span>
            Filters{activeCount ? ` · ${activeCount} active` : ''}
            {loading ? ' · loading…' : resultCount != null ? ` · ${resultCount} results` : ''}
          </span>
          <span className={`transition ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {open && <div className="surface mt-3 p-4">{body}</div>}
      </div>

      {/* Desktop: sticky sidebar */}
      <aside className="hidden lg:block">
        <div className="surface sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Filters</h2>
            {resultCount != null && (
              <span className="text-[11px] text-zinc-500">
                {loading ? 'loading…' : `${resultCount} results`}
              </span>
            )}
          </div>
          {body}
        </div>
      </aside>
    </>
  )
}
