'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PosterCard from '@/components/PosterCard'
import SearchBar from '@/components/SearchBar'
import FilterPanel, { EMPTY_FILTERS, type Filters } from '@/components/FilterPanel'
import type { Media, PageInfo } from '@/lib/anilist'
import { useProgress, useViewMode, useWatchlist } from '@/lib/store'

function filtersFromParams(sp: URLSearchParams): Filters {
  const score = Number(sp.get('scoreMin'))
  return {
    genres: sp.getAll('genre').filter(Boolean),
    year: sp.get('year') ?? '',
    season: sp.get('season') ?? '',
    format: sp.get('format') ?? '',
    status: sp.get('status') ?? '',
    scoreMin: Number.isFinite(score) && score > 0 ? score : 0,
    studio: sp.get('studio') ?? '',
    sort: sp.get('sort') ?? '',
  }
}

function paramsFromFilters(q: string, f: Filters): URLSearchParams {
  const sp = new URLSearchParams()
  if (q.trim()) sp.set('q', q.trim())
  f.genres.forEach((g) => sp.append('genre', g))
  if (f.year) sp.set('year', f.year)
  if (f.season) sp.set('season', f.season)
  if (f.format) sp.set('format', f.format)
  if (f.status) sp.set('status', f.status)
  if (f.scoreMin > 0) sp.set('scoreMin', String(f.scoreMin))
  if (f.studio.trim()) sp.set('studio', f.studio.trim())
  if (f.sort) sp.set('sort', f.sort)
  return sp
}

export default function SearchPage() {
  // useSearchParams must sit under a Suspense boundary, otherwise the whole
  // route is forced to client-side rendering.
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchView />
    </Suspense>
  )
}

function SearchFallback() {
  return (
    <div className="container-page pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">Browse</h1>
        <p className="mt-1 text-sm text-zinc-500">Loading…</p>
      </div>
    </div>
  )
}

function SearchView() {
  const router = useRouter()
  const sp = useSearchParams()
  const initialQuery = sp.get('q') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(sp))
  const [results, setResults] = useState<Media[]>([])
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { mode, setMode } = useViewMode()
  const { entries } = useWatchlist()
  const { all: progressMap } = useProgress()
  const abortRef = useRef<AbortController | null>(null)
  const firstRun = useRef(true)

  // Progress per anime so cards can show a watched bar.
  const watchedByAnime = useMemo(() => {
    const map: Record<number, number> = {}
    for (const p of Object.values(progressMap)) {
      map[p.animeId] = Math.max(map[p.animeId] ?? 0, p.episode)
    }
    return map
  }, [progressMap])

  const fetchPage = useCallback(
    async (q: string, f: Filters, targetPage: number) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setLoading(true)
      setError(null)

      const params = paramsFromFilters(q, f)
      params.set('action', 'search')
      params.set('page', String(targetPage))
      params.set('perPage', '30')

      try {
        const res = await fetch(`/api/anilist?${params.toString()}`, { signal: ctrl.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? `request failed (${res.status})`)
        setResults((data.media ?? []) as Media[])
        setPageInfo((data.pageInfo ?? null) as PageInfo | null)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults([])
        setPageInfo(null)
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    },
    [],
  )

  // Debounced fetch whenever the query or filters change; resets to page 1.
  useEffect(() => {
    const handle = setTimeout(
      () => {
        if (firstRun.current) {
          firstRun.current = false
        }
        setPage(1)
        void fetchPage(query, filters, 1)
        const sp = paramsFromFilters(query, filters)
        const qs = sp.toString()
        router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
      },
      firstRun.current ? 0 : 350,
    )
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters, fetchPage])

  const goToPage = (p: number) => {
    setPage(p)
    void fetchPage(query, filters, p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeFilterCount = useMemo(() => {
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

  const heading = query.trim()
    ? `Results for “${query.trim()}”`
    : filters.sort === 'TRENDING_DESC'
      ? 'Trending anime'
      : 'Browse anime'

  return (
    <div className="container-page animate-fade-in pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">{heading}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {pageInfo ? `${pageInfo.total.toLocaleString()} titles` : loading ? 'Searching…' : 'No results'}
          {activeFilterCount ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active` : ''}
        </p>
      </div>

      <div className="mb-6 max-w-2xl lg:hidden">
        <SearchBar initialValue={initialQuery} onChange={setQuery} suggestions />
      </div>

      <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          resultCount={pageInfo?.total}
          loading={loading}
        />

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="hidden max-w-xl flex-1 lg:block">
              <SearchBar initialValue={initialQuery} onChange={setQuery} suggestions />
            </div>

            <div className="flex items-center gap-2">
              {entries.length > 0 && (
                <span className="text-[11px] text-zinc-500">{entries.length} in watchlist</span>
              )}
              <div className="flex overflow-hidden rounded-lg border border-white/10">
                {(['grid', 'list'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={[
                      'px-3 py-2 text-[12px] font-medium capitalize transition',
                      mode === m ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5',
                    ].join(' ')}
                    aria-pressed={mode === m}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="surface mb-4 border-red-500/20 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading && !results.length ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i}>
                  <div className="skeleton aspect-[2/3] w-full" />
                  <div className="skeleton mt-2 h-3 w-4/5" />
                  <div className="skeleton mt-1.5 h-2.5 w-2/5" />
                </div>
              ))}
            </div>
          ) : results.length ? (
            <>
              {mode === 'grid' ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {results.map((m) => (
                    <PosterCard key={m.id} media={m} watchedEpisodes={watchedByAnime[m.id] ?? 0} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((m) => (
                    <PosterCard key={m.id} media={m} variant="list" watchedEpisodes={watchedByAnime[m.id] ?? 0} />
                  ))}
                </div>
              )}

              {pageInfo && pageInfo.lastPage > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={page <= 1 || loading}
                    onClick={() => goToPage(page - 1)}
                  >
                    ← Prev
                  </button>
                  <span className="px-3 text-sm text-zinc-400">
                    Page {pageInfo.currentPage} / {pageInfo.lastPage}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={!pageInfo.hasNextPage || loading}
                    onClick={() => goToPage(page + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="surface p-10 text-center">
              <p className="text-sm font-semibold text-zinc-200">No results</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
                Try a shorter query, clear a filter, or lower the minimum score. AniList search
                matches romaji and English titles.
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...EMPTY_FILTERS })}
                  className="btn-ghost mt-4"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
