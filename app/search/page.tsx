'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconGrid, IconList } from '../../components/icons'
import PosterCard from '@/components/PosterCard'
import FilterPanel, {
  EMPTY_FILTERS,
  filtersToQuery,
  queryToFilters,
  toApiQuery,
  type FilterState,
} from '@/components/FilterPanel'
import { ListSkeleton, PosterGridSkeleton } from '@/components/Skeletons'
import PreviewBanner from '@/components/PreviewBanner'
import type { Media } from '@/lib/anilist'
import { useViewMode } from '@/lib/store'

function SearchFallback() {
  return (
    <div className="container-page pt-6">
      <div className="skeleton h-11 w-full max-w-xl" />
      <div className="mt-6">
        <PosterGridSkeleton />
      </div>
    </div>
  )
}

function activeFilterCount(f: FilterState): number {
  let n = 0
  if (f.genres.length) n++
  if (f.year) n++
  if (f.season) n++
  if (f.format) n++
  if (f.status) n++
  if (f.scoreMin && f.scoreMin !== '0') n++
  if (f.studio) n++
  if (f.sort && f.sort !== 'POPULARITY_DESC') n++
  return n
}

function SearchView() {
  const router = useRouter()
  const sp = useSearchParams()
  const { mode, setMode } = useViewMode()

  const initialQ = sp.get('q') ?? ''
  const [input, setInput] = useState(initialQ)
  const [debouncedQ, setDebouncedQ] = useState(initialQ)
  const [filters, setFilters] = useState<FilterState>(() => queryToFilters(sp))
  const [results, setResults] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  // Debounce the query so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(input.trim()), 350)
    return () => clearTimeout(t)
  }, [input])

  // Keep the URL in sync so the page is shareable and back/forward works.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const p = new URLSearchParams(filtersToQuery(filters))
    if (debouncedQ) p.set('q', debouncedQ)
    const qs = p.toString()
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, filters])


  const load = useCallback(
    async (targetPage: number, signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/anilist?${toApiQuery(filters, debouncedQ, targetPage)}`, {
          signal,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? 'search failed')
        const list: Media[] = data.media ?? []
        setPreview(Boolean(data.preview))
        setResults((prev) => (targetPage === 1 ? list : [...prev, ...list]))
        setHasNext(Boolean(data.pageInfo?.hasNextPage))
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [filters, debouncedQ],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    void load(1, ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    const ctrl = new AbortController()
    void load(next, ctrl.signal)
  }

  const filterCount = useMemo(() => activeFilterCount(filters), [filters])


  return (
    <div className="container-page pt-5">
      {/* No field here on purpose: the top bar holds the single app-wide search
          surface, so there is one place to type and one set of suggestions. */}
      <div className="mb-4">
        <p className="eyebrow mb-1">Search</p>
        <h1 className="section-title">
          {debouncedQ ? `Results for “${debouncedQ}”` : 'Browse the catalogue'}
        </h1>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[260px_1fr]">
        <FilterPanel value={filters} onChange={setFilters} activeCount={filterCount} />

        <div className="min-w-0">
          {preview && (
            <div className="mb-4">
              <PreviewBanner compact />
            </div>
          )}

          {/* Result header */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
              {loading && results.length === 0
                ? 'Searching…'
                : `${results.length}${hasNext ? '+' : ''} result${results.length === 1 ? '' : 's'}`}
              {debouncedQ ? ` for “${debouncedQ}”` : ''}
            </p>

            <div className="flex overflow-hidden rounded-lg border border-white/[0.08]">
              {(
                [
                  { m: 'grid' as const, Icon: IconGrid, label: 'Grid' },
                  { m: 'list' as const, Icon: IconList, label: 'List' },
                ]
              ).map(({ m, Icon, label }) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-label={`${label} view`}
                  className={[
                    'grid h-8 w-8 place-items-center transition-colors',
                    mode === m ? 'bg-accent/20 text-accent-soft' : 'text-zinc-500 hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="surface mb-4 p-4 text-sm text-red-300">{error}</div>
          )}

          {loading && results.length === 0 ? (
            mode === 'grid' ? <PosterGridSkeleton /> : <ListSkeleton />
          ) : results.length === 0 ? (
            <div className="surface grid place-items-center p-12 text-center">
              <p className="text-sm text-zinc-400">Nothing matched those filters.</p>
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS)
                  setInput('')
                }}
                className="btn-ghost mt-3 h-9 text-xs"
              >
                Clear everything
              </button>
            </div>
          ) : mode === 'grid' ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {results.map((m) => (
                <PosterCard key={m.id} media={m} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((m) => (
                <PosterCard key={m.id} media={m} variant="list" />
              ))}
            </div>
          )}

          {hasNext && (
            <div className="mt-8 flex justify-center">
              <button type="button" onClick={loadMore} disabled={loading} className="btn-ghost h-10 px-6">
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchView />
    </Suspense>
  )
}
