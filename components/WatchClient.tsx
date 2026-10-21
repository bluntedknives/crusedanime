'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Player, { type PlayerPayload } from './Player'
import EpisodeList from './EpisodeList'
import type { EpisodeInfo } from '@/lib/consumet'
import { usePrefs, useProgress, useWatchlist } from '@/lib/store'
import { formatLabel, scoreOf, type Media } from '@/lib/anilist'

interface Props {
  media: Media
  episode: number
  altTitles: string[]
}

export default function WatchClient({ media, episode, altTitles }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const urlType = sp.get('type') === 'dub' ? 'dub' : null

  const { prefs, update } = usePrefs()
  const type = (urlType ?? prefs.preferredType) as 'sub' | 'dub'

  const [payload, setPayload] = useState<PlayerPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([])
  const [epsLoading, setEpsLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const { get } = useProgress()
  const { toggle, has } = useWatchlist()
  const progress = get(media.id, type)

  const title = media.title.userPreferred || media.title.english || media.title.romaji || 'Unknown'

  const episodeMeta = useMemo(
    () => episodes.find((e) => e.number === episode) ?? null,
    [episodes, episode],
  )

  /* --------------------------------------------------------- episode list */

  useEffect(() => {
    const ctrl = new AbortController()
    setEpsLoading(true)

    const params = new URLSearchParams({ anilistId: String(media.id), title })
    if (media.idMal) params.set('malId', String(media.idMal))
    if (media.episodes) params.set('totalEpisodes', String(media.episodes))
    altTitles.slice(0, 3).forEach((a) => params.append('alt', a))

    fetch(`/api/episodes?${params.toString()}`, { signal: ctrl.signal })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d?.error ?? 'failed')
        return d as { episodes: EpisodeInfo[] }
      })
      .then((d) => setEpisodes(d.episodes ?? []))
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setEpsLoading(false)
      })

    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.id, title, media.episodes, media.idMal])

  /* -------------------------------------------------------------- streams */

  const loadStream = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      setPayload(null)

      const params = new URLSearchParams({
        anilistId: String(media.id),
        episode: String(episode),
        title,
        type,
      })
      if (media.idMal) params.set('malId', String(media.idMal))
      altTitles.slice(0, 3).forEach((a) => params.append('alt', a))

      try {
        const res = await fetch(`/api/stream?${params.toString()}`, { signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? `stream request failed (${res.status})`)
        setPayload({
          provider: data.provider,
          sources: data.sources ?? [],
          subtitles: data.subtitles ?? [],
          intro: data.intro ?? null,
          outro: data.outro ?? null,
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Could not resolve a stream')
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [media.id, media.idMal, episode, title, type, nonce],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    void loadStream(ctrl.signal)
    return () => ctrl.abort()
  }, [loadStream])

  const retry = () => setNonce((n) => n + 1)

  const switchType = (t: 'sub' | 'dub') => {
    update({ preferredType: t })
    router.replace(`/watch/${media.id}/${episode}${t === 'dub' ? '?type=dub' : ''}`)
  }

  const totalEpisodes = episodes.length || media.episodes || null
  const hasNext = totalEpisodes == null ? true : episode < totalEpisodes
  const hasPrev = episode > 1

  const relatedEps = useMemo(() => {
    const list = episodes.length
      ? episodes
      : Array.from({ length: media.episodes ?? 0 }, (_, i) => ({
          number: i + 1,
          id: `synthetic-${i + 1}`,
          title: null,
          image: null,
          description: null,
          filler: false,
          hasSub: true,
          hasDub: false,
        }))
    return list
  }, [episodes, media.episodes])

  const dubAvailable = episodes.some((e) => e.hasDub)

  return (
    <div className="container-page pt-4">
      {/* breadcrumb */}
      <nav className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-300">
          Home
        </Link>
        <span>/</span>
        <Link href={`/anime/${media.id}`} className="truncate hover:text-zinc-300">
          {title}
        </Link>
        <span>/</span>
        <span className="text-zinc-300">Episode {episode}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ------------------------------------------------------- player col */}
        <div className="min-w-0">
          <Player
            animeId={media.id}
            animeTitle={title}
            poster={media.bannerImage || media.coverImage?.extraLarge || ''}
            totalEpisodes={totalEpisodes}
            episode={episode}
            type={type}
            payload={payload}
            loading={loading}
            error={error}
            onRetry={retry}
          />

          {/* controls row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={hasPrev ? `/watch/${media.id}/${episode - 1}${type === 'dub' ? '?type=dub' : ''}` : '#'}
              aria-disabled={!hasPrev}
              className={['btn-ghost', !hasPrev ? 'pointer-events-none opacity-40' : ''].join(' ')}
            >
              ← Previous
            </Link>
            <Link
              href={hasNext ? `/watch/${media.id}/${episode + 1}${type === 'dub' ? '?type=dub' : ''}` : '#'}
              aria-disabled={!hasNext}
              className={['btn-ghost', !hasNext ? 'pointer-events-none opacity-40' : ''].join(' ')}
            >
              Next →
            </Link>

            <div className="flex overflow-hidden rounded-lg border border-white/10">
              {(['sub', 'dub'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchType(t)}
                  disabled={t === 'dub' && !dubAvailable}
                  className={[
                    'px-3 py-2 text-[12px] font-semibold uppercase transition disabled:opacity-40',
                    type === t ? 'bg-brand text-white' : 'text-zinc-300 hover:bg-white/5',
                  ].join(' ')}
                  title={t === 'dub' && !dubAvailable ? 'No dub available for this title' : `Switch to ${t}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={retry} className="btn-subtle text-xs">
                ↻ Reload stream
              </button>
              <button
                type="button"
                onClick={() => toggle(media)}
                className={['btn-subtle text-xs', has(media.id) ? 'text-brand-soft' : ''].join(' ')}
              >
                {has(media.id) ? '✓ In watchlist' : '+ Watchlist'}
              </button>
            </div>
          </div>

          {/* episode title */}
          <div className="mt-4">
            <h1 className="text-lg font-bold tracking-tight text-zinc-50 sm:text-xl">
              {episodeMeta?.title?.trim()
                ? `EP ${episode} · ${episodeMeta.title}`
                : `Episode ${episode}`}
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              {title} · {formatLabel(media.format)}
              {media.seasonYear ? ` · ${media.seasonYear}` : ''}
              {progress ? ` · last watched EP ${progress.episode}` : ''}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/anime/${media.id}`} className="btn-ghost text-xs">
              Series details
            </Link>
            <Link href="/schedule" className="btn-ghost text-xs">
              Airing schedule
            </Link>
            <Link href="/watchlist" className="btn-ghost text-xs">
              My watchlist
            </Link>
          </div>
        </div>

        {/* -------------------------------------------------------- side col */}
        <aside className="space-y-5">
          <div className="surface p-3">
            <div className="flex gap-3">
              <Link href={`/anime/${media.id}`} className="h-[104px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-ink-700">
                {media.coverImage?.large ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={media.coverImage.large}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </Link>
              <div className="min-w-0">
                <Link
                  href={`/anime/${media.id}`}
                  className="line-clamp-2 text-[13px] font-semibold text-zinc-100 hover:text-brand-soft"
                >
                  {title}
                </Link>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {formatLabel(media.format)}
                  {media.seasonYear ? ` · ${media.seasonYear}` : ''}
                  {scoreOf(media) != null ? ` · ★ ${(scoreOf(media)! / 10).toFixed(1)}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(media.genres ?? []).slice(0, 3).map((g) => (
                    <span key={g} className="chip">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="surface p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">Episodes</h2>
              {payload && (
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {payload.provider}
                </span>
              )}
            </div>
            <EpisodeList
              animeId={media.id}
              episodes={relatedEps}
              progress={progress}
              type={type}
              loading={epsLoading}
              maxHeight="70vh"
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
