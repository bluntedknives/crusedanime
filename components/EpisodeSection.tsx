'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EpisodeList from './EpisodeList'
import SeriesDownloads from './SeriesDownloads'
import type { EpisodeInfo } from '@/lib/consumet'
import { useProgress, usePrefs } from '@/lib/store'
import { coverLabel } from '@/lib/cover'

interface Props {
  animeId: number
  malId: number | null
  title: string
  altTitles: string[]
  totalEpisodes: number | null
  /** Airing titles have no provider entry yet; show a hint instead of an error. */
  status: string | null
  /** Restricted mode: relabel headings before render, not after. */
  covered?: boolean
  poster?: string
  genres?: string[]
}

export default function EpisodeSection({
  animeId,
  malId,
  title,
  altTitles,
  totalEpisodes,
  status,
  covered = false,
  poster = '',
  genres,
}: Props) {
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { prefs, update } = usePrefs()
  const { get } = useProgress()

  const type = prefs.preferredType
  const progress = get(animeId, type)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      anilistId: String(animeId),
      title,
    })
    if (malId) params.set('malId', String(malId))
    if (totalEpisodes) params.set('totalEpisodes', String(totalEpisodes))
    altTitles.slice(0, 3).forEach((a) => params.append('alt', a))

    fetch(`/api/episodes?${params.toString()}`, { signal: ctrl.signal })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error ?? `failed (${r.status})`)
        return data as { episodes: EpisodeInfo[] }
      })
      .then((d) => setEpisodes(d.episodes ?? []))
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Could not load episodes')
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })

    return () => ctrl.abort()
  }, [animeId, malId, title, totalEpisodes, altTitles])

  const notYetAired = status === 'NOT_YET_RELEASED' && !episodes.length

  return (
    <section id="episodes" className="surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{coverLabel('Episodes', covered)}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {loading
              ? 'Resolving from provider…'
              : episodes.length
                ? `${episodes.length} available · ${type.toUpperCase()}`
                : 'Nothing available yet'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">Audio</span>
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            {(['sub', 'dub'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update({ preferredType: t })}
                disabled={t === 'dub' && !episodes.some((e) => e.hasDub)}
                className={[
                  'px-3 py-1.5 text-[12px] font-semibold uppercase transition disabled:opacity-40',
                  type === t ? 'bg-accent text-white' : 'text-zinc-300 hover:bg-white/5',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
          {error}
          {episodes.length === 0 && totalEpisodes ? (
            <span className="block text-amber-200/70">
              Showing {totalEpisodes} episodes from AniList metadata instead.
            </span>
          ) : null}
        </div>
      )}

      {notYetAired ? (
        <p className="py-6 text-center text-sm text-zinc-400">
          This title has not aired yet. Episodes will appear here once the provider has them.
        </p>
      ) : (
        <EpisodeList
          animeId={animeId}
          episodes={episodes}
          progress={progress}
          type={type}
          loading={loading}
          maxHeight="620px"
        />
      )}

      {episodes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/watch/${animeId}/${progress?.episode ?? 1}${type === 'dub' ? '?type=dub' : ''}`} className="btn-primary">
            ▶ {progress ? `Resume EP ${progress.episode}` : 'Watch episode 1'}
          </Link>
          {progress && (
            <Link
              href={`/watch/${animeId}/${Math.min(
                (progress.episode ?? 1) + 1,
                episodes.length,
              )}${type === 'dub' ? '?type=dub' : ''}`}
              className="btn-ghost"
            >
              Next episode
            </Link>
          )}
        </div>
      )}

      {episodes.length > 0 && (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <SeriesDownloads
            animeId={animeId}
            animeTitle={title}
            poster={poster}
            malId={malId}
            genres={genres}
            episodes={episodes}
            totalEpisodes={totalEpisodes}
            type={type}
          />
        </div>
      )}
    </section>
  )
}

