'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconRefresh } from './icons'
import { IconClose, IconSliders } from './icons'

export interface FilterState {
  genres: string[]
  year: string
  season: string
  format: string
  status: string
  scoreMin: string
  studio: string
  sort: string
}

export const EMPTY_FILTERS: FilterState = {
  genres: [],
  year: '',
  season: '',
  format: '',
  status: '',
  scoreMin: '',
  studio: '',
  sort: 'POPULARITY_DESC',
}

const FORMATS: { value: string; label: string }[] = [
  { value: 'TV', label: 'TV' },
  { value: 'TV_SHORT', label: 'TV Short' },
  { value: 'MOVIE', label: 'Movie' },
  { value: 'SPECIAL', label: 'Special' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
  { value: 'MUSIC', label: 'Music' },
]
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
const STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS']
const SORTS = [
  { value: 'POPULARITY_DESC', label: 'Most popular' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'SCORE_DESC', label: 'Highest rated' },
  { value: 'START_DATE_DESC', label: 'Newest' },
  { value: 'TITLE_ROMAJI', label: 'A–Z' },
]
const SCORES = [0, 60, 70, 75, 80, 85, 90]

function humanize(v: string): string {
  return v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function filtersToQuery(f: FilterState): string {
  const p = new URLSearchParams()
  if (f.genres.length) p.set('genre', f.genres.join(','))
  if (f.year) p.set('year', f.year)
  if (f.season) p.set('season', f.season)
  if (f.format) p.set('format', f.format)
  if (f.status) p.set('status', f.status)
  if (f.scoreMin && f.scoreMin !== '0') p.set('scoreMin', f.scoreMin)
  if (f.studio) p.set('studio', f.studio)
  if (f.sort) p.set('sort', f.sort)
  return p.toString()
}

export function queryToFilters(sp: URLSearchParams): FilterState {
  return {
    genres: (sp.get('genre') ?? '').split(',').filter(Boolean),
    year: sp.get('year') ?? '',
    season: sp.get('season') ?? '',
    format: sp.get('format') ?? '',
    status: sp.get('status') ?? '',
    scoreMin: sp.get('scoreMin') ?? '',
    studio: sp.get('studio') ?? '',
    sort: sp.get('sort') ?? 'POPULARITY_DESC',
  }
}

/**
 * Build the API query string, skipping every empty value. Passing `undefined`
 * into `URLSearchParams` would serialize it as the literal string
 * "undefined" and poison the filters, so each field is added explicitly.
 */
export function toApiQuery(f: FilterState, q: string, page: number, perPage = 30): string {
  const p = new URLSearchParams()
  p.set('action', 'search')
  p.set('page', String(page))
  p.set('perPage', String(perPage))
  if (q) p.set('q', q)
  if (f.genres.length) p.set('genre', f.genres.join(','))
  if (f.year) p.set('year', f.year)
  if (f.season) p.set('season', f.season)
  if (f.format) p.set('format', f.format)
  if (f.status) p.set('status', f.status)
  if (f.scoreMin && f.scoreMin !== '0') p.set('scoreMin', f.scoreMin)
  if (f.studio) p.set('studio', f.studio)
  if (f.sort) p.set('sort', f.sort)
  return p.toString()
}

interface Props {
  value: FilterState
  onChange: (next: FilterState) => void
  /** Count of active filters, used for the mobile badge. */
  activeCount: number
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/[0.06] px-4 py-3.5 first:border-t-0">
      <h3 className="mb-2.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-600">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'border-accent/50 bg-accent/15 text-accent-soft'
          : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function FilterPanel({ value, onChange, activeCount }: Props) {
  const [genres, setGenres] = useState<string[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/anilist?action=genres')
      .then((r) => r.json())
      .then((d) => {
        if (alive) setGenres(d.genres ?? [])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const years = useMemo(() => {
    const now = new Date().getFullYear() + 1
    return Array.from({ length: 60 }, (_, i) => String(now - i))
  }, [])

  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) =>
    onChange({ ...value, [key]: v })

  const toggleGenre = (g: string) =>
    onChange({
      ...value,
      genres: value.genres.includes(g)
        ? value.genres.filter((x) => x !== g)
        : [...value.genres, g],
    })

  const reset = () => onChange(EMPTY_FILTERS)

  const body = (
    <>
      <Section title="Sort by">
        <select
          value={value.sort}
          onChange={(e) => set('sort', e.target.value)}
          className="input py-2 text-xs"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Genre">
        <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
          {genres.map((g) => (
            <Pill key={g} active={value.genres.includes(g)} onClick={() => toggleGenre(g)}>
              {g}
            </Pill>
          ))}
          {genres.length === 0 && <p className="text-xs text-zinc-600">Loading…</p>}
        </div>
      </Section>

      <Section title="Year">
        <select value={value.year} onChange={(e) => set('year', e.target.value)} className="input py-2 text-xs">
          <option value="">Any year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Season">
        <div className="flex flex-wrap gap-1.5">
          {SEASONS.map((s) => (
            <Pill key={s} active={value.season === s} onClick={() => set('season', value.season === s ? '' : s)}>
              {humanize(s)}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Format">
        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <Pill
              key={f.value}
              active={value.format === f.value}
              onClick={() => set('format', value.format === f.value ? '' : f.value)}
            >
              {f.label}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Status">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Pill key={s} active={value.status === s} onClick={() => set('status', value.status === s ? '' : s)}>
              {humanize(s)}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Minimum score">
        <div className="flex flex-wrap gap-1.5">
          {SCORES.map((s) => (
            <Pill
              key={s}
              active={value.scoreMin === String(s)}
              onClick={() => set('scoreMin', value.scoreMin === String(s) ? '' : String(s))}
            >
              {s === 0 ? 'Any' : `${s}+`}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Studio">
        <input
          value={value.studio}
          onChange={(e) => set('studio', e.target.value)}
          placeholder="e.g. ufotable"
          className="input py-2 text-xs"
        />
      </Section>

      <div className="border-t border-white/[0.06] p-4">
        <button type="button" onClick={reset} className="btn-ghost h-9 w-full text-xs">
          <IconRefresh size={14} />
          Reset filters
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop panel */}
      <aside className="surface sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto lg:block">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <IconSliders size={16} />
            Filters
          </h2>
          {activeCount > 0 && (
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[0.6rem] text-accent-soft">
              {activeCount}
            </span>
          )}
        </div>
        {body}
      </aside>

      {/* Mobile trigger + sheet */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="btn-ghost h-10 w-full lg:hidden"
      >
        <IconSliders size={16} />
        Filters
        {activeCount > 0 && (
          <span className="rounded-md bg-accent/20 px-1.5 py-0.5 font-mono text-[0.6rem] text-accent-soft">
            {activeCount}
          </span>
        )}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="surface-raised absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-b-none animate-fade-up">
            <div className="sticky top-0 flex items-center justify-between border-b border-white/[0.07] bg-base-850/95 px-4 py-3 backdrop-blur">
              <h2 className="text-sm font-semibold text-zinc-100">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="btn-icon h-8 w-8"
                aria-label="Close filters"
              >
                <IconClose size={16} />
              </button>
            </div>
            {body}
          </div>
        </div>
      )}
    </>
  )
}
