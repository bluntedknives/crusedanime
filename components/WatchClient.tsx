'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconArrowLeft, IconBookmark, IconBookmarkFilled, IconChevronLeft, IconChevronRight, IconRefresh } from './icons'
import Player, { type PlayerPayload } from './Player'
import EpisodeList from './EpisodeList'
import { detailPath } from './PosterCard'
import { coverLabel } from '@/lib/cover'
import type { EpisodeInfo } from '@/lib/consumet'
import { useHistory, usePrefs, useProgress, useWatchlist } from '@/lib/store'
import { formatLabel, posterOf, scoreOf, titleOf, type Media } from '@/lib/anilist'

interface Props {
  media: Media
  episode: number
  altTitles: string[]
  /** Restricted mode: relabel headings at render time. */
  covered?: boolean
  /**
   * Episode list supplied by the server. The film/series catalogue has no
   * provider episode endpoint, so its list is handed over instead of fetched.
   */
  initialEpisodes?: EpisodeInfo[]
}

export default function WatchClient({
  media,
  episode,
  altTitles,
  covered = false,
  initialEpisodes,
}: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const urlType = sp.get('type') === 'dub' ? 'dub' : null

  const { prefs, update } = usePrefs()
  const type = (urlType ?? prefs.preferredType) as 'sub' | 'dub'

  const [payload, setPayload] = useState<PlayerPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>(initialEpisodes ?? [])
  const [epsLoading, setEpsLoading] = useState(!initialEpisodes)
  const [nonce, setNonce] = useState(0)
  const [theater, setTheater] = useState(false)

  const { get } = useProgress()
  const { toggle, has } = useWatchlist()
  const { record } = useHistory()
  const progress = get(media.id, type)

  const title = titleOf(media)
  const inList = has(media.id)

  const episodeMeta = useMemo(
    () => episodes.find((e) => e.number === episode) ?? null,
    [episodes, episode],
  )

  /* --------------------------------------------------------- episode list */

  useEffect(() => {
    // A supplied list is authoritative; the anime provider knows nothing about
    // these titles and would only return an empty set.
    if (initialEpisodes) return
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
      // The film catalogue matches on title plus year, which disambiguates
      // remakes and re-releases that share a name.
      if (media.seasonYear) params.set('year', String(media.seasonYear))
      altTitles.slice(0, 3).forEach((a) => params.append('alt', a))

      try {
        const res = await fetch(`/api/stream?${params.toString()}`, { signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? `stream request failed (${res.status})`)
        if (data.unavailable || (Array.isArray(data.sources) && data.sources.length === 0)) {
          setError(data.reason || 'No playable source was found for this title.')
          return
        }
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

  // Record the view once a stream actually resolves.
  useEffect(() => {
    if (!payload?.sources?.length) return
    record({
      animeId: media.id,
      episode,
      title,
      poster: posterOf(media),
      type,
      completion: 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, media.id, episode, type, title])

  const retry = () => setNonce((n) => n + 1)

  const switchType = (t: 'sub' | 'dub') => {
    update({ preferredType: t })
    router.replace(`/watch/${media.id}/${episode}${t === 'dub' ? '?type=dub' : ''}`)
  }

  const totalEpisodes = episodes.length || media.episodes || null
  const hasNext = totalEpisodes == null ? true : episode < totalEpisodes
  const hasPrev = episode > 1

  const listEpisodes = useMemo(() => {
    if (episodes.length) return episodes
    return Array.from({ length: media.episodes ?? 0 }, (_, i) => ({
      number: i + 1,
      id: `synthetic-${i + 1}`,
      title: null,
      image: null,
      description: null,
      filler: false,
      hasSub: true,
      hasDub: false,
    })) as EpisodeInfo[]
  }, [episodes, media.episodes])

  const dubAvailable = episodes.some((e) => e.hasDub)

  return (
    <div className="container-page pt-3">
      {/* breadcrumb */}
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500">
        <Link href="/" className="transition-colors hover:text-zinc-200">
          Home
        </Link>
        <span className="text-zinc-700">/</span>
        <Link href={detailPath(media.id)} className="truncate transition-colors hover:text-zinc-200">
          {title}
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-300">Episode {episode}</span>
      </nav>

      <div
        className={[
          'grid gap-6',
          theater ? '' : 'xl:grid-cols-[1fr_340px]',
        ].join(' ')}
      >
        {/* ------------------------------------------------------ player col */}
        <div className="min-w-0">
          <Player
              animeId={media.id}
              animeTitle={title}
              poster={media.bannerImage || posterOf(media)}
              totalEpisodes={totalEpisodes}
              episode={episode}
              type={type}
              payload={payload}
              loading={loading}
              error={error}
              onRetry={retry}
              theater={theater}
            onTheaterChange={setTheater}
          />

          {/* Action row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={hasPrev ? `/watch/${media.id}/${episode - 1}${type === 'dub' ? '?type=dub' : ''}` : '#'}
              aria-disabled={!hasPrev}
              className={['btn-ghost h-9 px-3 text-xs', !hasPrev ? 'pointer-events-none opacity-40' : ''].join(' ')}
            >
              <IconChevronLeft size={16} />
              Prev
            </Link>
            <Link
              href={hasNext ? `/watch/${media.id}/${episode + 1}${type === 'dub' ? '?type=dub' : ''}` : '#'}
              aria-disabled={!hasNext}
              className={['btn-ghost h-9 px-3 text-xs', !hasNext ? 'pointer-events-none opacity-40' : ''].join(' ')}
            >
              Next
              <IconChevronRight size={16} />
            </Link>

            <div className="flex overflow-hidden rounded-lg border border-white/[0.08]">
              {(['sub', 'dub'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchType(t)}
                  disabled={t === 'dub' && !dubAvailable}
                  title={t === 'dub' && !dubAvailable ? 'No dub available for this title' : `Switch to ${t}`}
                  className={[
                    'px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition disabled:opacity-40',
                    type === t ? 'bg-accent text-white' : 'text-zinc-400 hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" onClick={retry} className="btn-ghost h-9 px-3 text-xs">
                <IconRefresh size={14} />
                Reload
              </button>
              <button
                type="button"
                onClick={() => toggle(media)}
                className={[
                  'btn-ghost h-9 px-3 text-xs',
                  inList ? 'border-accent/40 bg-accent/10 text-accent-soft' : '',
                ].join(' ')}
              >
                {inList ? (
                  <IconBookmarkFilled size={14} />
                ) : (
                  <IconBookmark size={14} />
                )}
                {inList ? 'In watchlist' : 'Watchlist'}
              </button>
            </div>
          </div>

          {/* Episode heading */}
          <div className="mt-5">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-accent-soft">
              Episode {episode}
              {payload?.provider ? ` · ${payload.provider}` : ''}
            </p>
            <h1 className="mt-1 text-lg font-bold tracking-tight text-zinc-50 sm:text-2xl">
              {episodeMeta?.title?.trim() ? episodeMeta.title : title}
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              {title} · {formatLabel(media.format)}
              {media.seasonYear ? ` · ${media.seasonYear}` : ''}
              {progress ? ` · last watched EP ${progress.episode}` : ''}
            </p>
          </div>

          {/* Mobile episode list (the sidebar holds it on wide screens) */}
          <div className={['mt-5 xl:hidden', theater ? 'hidden' : ''].join(' ')}>
            <div className="surface p-3">
              <h2 className="mb-3 text-sm font-semibold text-zinc-100">{coverLabel('Episodes', covered)}</h2>
              <EpisodeList
                animeId={media.id}
                episodes={listEpisodes}
                progress={progress}
                type={type}
                loading={epsLoading}
                maxHeight="60vh"
              />
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------- side col */}
        <aside className={['space-y-4', theater ? 'hidden' : ''].join(' ')}>
          <div className="surface p-3">
            <div className="flex gap-3">
              <Link
                href={detailPath(media.id)}
                className="h-[112px] w-[78px] shrink-0 overflow-hidden rounded-lg bg-base-700"
              >
                {posterOf(media) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterOf(media)} alt="" className="h-full w-full object-cover" />
                ) : null}
              </Link>
              <div className="min-w-0">
                <Link
                  href={detailPath(media.id)}
                  className="line-clamp-2 text-sm font-semibold text-zinc-100 transition-colors hover:text-accent-soft"
                >
                  {title}
                </Link>
                <p className="mt-1 font-mono text-[0.65rem] text-zinc-500">
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
                <Link
                  href={detailPath(media.id)}
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-accent-soft transition-colors hover:text-white"
                >
                  <IconArrowLeft size={12} />
                  Series details
                </Link>
              </div>
            </div>
          </div>

          <div className="surface hidden p-3 xl:block">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">{coverLabel('Episodes', covered)}</h2>
              <span className="font-mono text-[0.6rem] uppercase tracking-wide text-zinc-600">
                {listEpisodes.length || '—'} total
              </span>
            </div>
            <EpisodeList
              animeId={media.id}
              episodes={listEpisodes}
              progress={progress}
              type={type}
              loading={epsLoading}
              maxHeight="72vh"
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
