'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IconBookmark, IconBookmarkFilled } from './icons'
import { IconPlay, IconStar } from './icons'
import TitleLogo from './TitleLogo'
import {
  formatLabel,
  posterOf,
  scoreOf,
  seasonLabel,
  stripHtml,
  titleOf,
  type Media,
} from '@/lib/anilist'
import { useProgress, useWatchlist } from '@/lib/store'
import WarmStream from './WarmStream'

interface Props {
  media: Media
}

/**
 * Immersive detail hero: the banner fills the viewport behind a slow zoom
 * (the "anime playing in the background" effect), with the cover art and title
 * lockup on top and a primary play action. Continues from the saved episode
 * when there is one.
 */
export default function DetailHero({ media }: Props) {
  const { has, toggle } = useWatchlist()
  const { get } = useProgress()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const title = titleOf(media)
  const poster = posterOf(media)
  const score = scoreOf(media)
  const backdrop = media.bannerImage ?? poster
  const inList = has(media.id)

  // Only read progress after mount so the server and client markup agree.
  const progress = mounted ? get(media.id) : null
  const playEp = progress?.episode ?? 1
  const resumePct =
    progress && progress.duration ? Math.min(100, (progress.position / progress.duration) * 100) : 0

  const studios = media.studios?.edges?.map((e) => e.node.name).filter(Boolean) ?? []
  const trailerId = media.trailer?.site === 'youtube' ? media.trailer.id : null

  return (
    <section className="relative isolate overflow-hidden">
      {/* Backdrop: the title's trailer when one exists, otherwise banner art. */}
      <div className="absolute inset-0 -z-10">
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdrop}
            alt=""
            className="h-full w-full scale-105 object-cover opacity-70 animate-[kenburns_24s_ease-in-out_infinite_alternate]"
          />
        ) : (
          <div className="h-full w-full bg-white/[0.02]" />
        )}
        {trailerId && (
          <div className="absolute inset-0 overflow-hidden">
            <iframe
              key={trailerId}
              title={`${title} trailer`}
              src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerId}&modestbranding=1&playsinline=1&rel=0&disablekb=1&iv_load_policy=3`}
              allow="autoplay; encrypted-media"
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 opacity-40"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
      </div>

      <div className="container-page">
        <div className="flex min-h-[420px] flex-col justify-end gap-6 pb-8 pt-24 sm:min-h-[520px] sm:pb-10 sm:pt-32 lg:min-h-[580px]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            {/* Cover art standing in for the show logo */}
            <div className="poster-shadow w-[150px] shrink-0 overflow-hidden rounded-xl border border-white/10 sm:w-[190px] lg:w-[210px]">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={title} className="aspect-[2/3] w-full object-cover" />
              ) : (
                <div className="grid aspect-[2/3] place-items-center bg-base-800 p-4 text-center text-xs text-zinc-500">
                  {title}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 animate-fade-up">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {media.status === 'RELEASING' && <span className="chip chip-live">Airing</span>}
                <span className="chip">{formatLabel(media.format)}</span>
                <span className="chip">{seasonLabel(media.season, media.seasonYear)}</span>
                {score != null && (
                  <span className="chip">
                    <IconStar size={10} className="text-amber-400" />
                    {(score / 10).toFixed(1)}
                  </span>
                )}
                {media.episodes != null && <span className="chip">{media.episodes} EP</span>}
              </div>

              <TitleLogo media={media} />

              <p className="mt-3 line-clamp-3 max-w-2xl text-xs leading-relaxed text-zinc-400 sm:text-sm">
                {stripHtml(media.description) || 'No synopsis available yet.'}
              </p>

              {studios.length > 0 && (
                <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
                  {studios.slice(0, 3).join(' · ')}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link href={`/watch/${media.id}/${playEp}`} className="btn-primary h-11 px-6">
                  <IconPlay size={16} />
                  {progress && progress.episode > 0
                    ? `Resume EP ${progress.episode}`
                    : 'Play episode 1'}
                </Link>

                <button
                  type="button"
                  onClick={() => toggle(media)}
                  className={[
                    'btn-ghost h-11 px-4',
                    inList ? 'border-accent/40 bg-accent/10 text-accent-soft' : '',
                  ].join(' ')}
                >
                  {inList ? (
                    <IconBookmarkFilled size={16} />
                  ) : (
                    <IconBookmark size={16} />
                  )}
                  {inList ? 'In watchlist' : 'Add to watchlist'}
                </button>
              </div>

              {resumePct > 0 && (
                <div className="mt-4 max-w-xs">
                  <div className="h-1 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${resumePct}%` }} />
                  </div>
                  <p className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-wide text-zinc-500">
                    EP {progress?.episode} · {Math.round(resumePct)}% watched
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resolve the first stream in the background so Play starts instantly. */}
      <WarmStream
        anilistId={media.id}
        malId={media.idMal}
        title={title}
        altTitles={[media.title.english, media.title.romaji, media.title.native].filter(
          (t): t is string => Boolean(t) && t !== title,
        )}
        episode={playEp}
        type="sub"
      />
    </section>
  )
}
