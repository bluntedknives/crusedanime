'use client'

import Link from 'next/link'
import { useState } from 'react'
import { IconCheck, IconPlay, IconPlus, IconStar } from './icons'
import {
  formatLabel,
  posterOf,
  scoreOf,
  seasonLabel,
  titleOf,
  type Media,
} from '@/lib/anilist'
import { useProgress, useWatchlist } from '@/lib/store'

type Variant = 'grid' | 'list' | 'compact' | 'banner' | 'continue'

/**
 * Route for a title's detail page. AniList ids are positive and live under
 * `/anime`.
 *
 * Playback is deliberately *not* forked: both kinds play through
 * `/watch/<id>/<ep>`, because ids are unique across the two catalogues (one
 * side is always negative). That keeps the player, progress and history code
 * single-path.
 */
export function detailPath(id: number): string {
  return `/anime/${id}`
}

interface Props {
  media: Media
  variant?: Variant
  watchedEpisodes?: number
  /** 1-based rank, shown as an overlay on banner cards. */
  rank?: number
  className?: string
}

/** Score bands, rendered in the accent ramp rather than raw green/red. */
function scoreTone(score: number | null): string {
  if (score == null) return 'text-zinc-400'
  if (score >= 80) return 'text-signal'
  if (score >= 65) return 'text-accent-soft'
  return 'text-zinc-400'
}

export default function PosterCard({
  media,
  variant = 'grid',
  watchedEpisodes = 0,
  rank,
  className = '',
}: Props) {
  const { has, toggle } = useWatchlist()
  const { get } = useProgress()
  const [imgOk, setImgOk] = useState(true)

  const title = titleOf(media)
  const poster = posterOf(media)
  const score = scoreOf(media)
  const href = detailPath(media.id)
  const inList = has(media.id)

  const total = media.episodes ?? 0
  const progressPct =
    total > 0 && watchedEpisodes > 0 ? Math.min(100, (watchedEpisodes / total) * 100) : 0

  const WatchToggle = (
    <button
      type="button"
      aria-label={inList ? 'Remove from watchlist' : 'Add to watchlist'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(media)
      }}
      className={[
        'grid h-7 w-7 place-items-center rounded border transition-all',
        inList
          ? 'border-accent/60 bg-accent text-base-900'
          : 'border-white/20 bg-black/70 text-white opacity-0 backdrop-blur group-hover:opacity-100 focus-visible:opacity-100',
      ].join(' ')}
    >
      {inList ? <IconCheck size={14} /> : <IconPlus size={14} />}
    </button>
  )

  /* ------------------------------------------------------------- compact */
  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className={`group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-white/[0.05] ${className}`}
      >
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-base-700">
          {poster && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={title}
              loading="lazy"
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-100 group-hover:text-accent-soft">
            {title}
          </p>
          <p className="mt-0.5 truncate font-mono text-[0.65rem] text-zinc-500">
            {formatLabel(media.format)} · {seasonLabel(media.season, media.seasonYear)}
          </p>
        </div>
        {score != null && (
          <span className={`shrink-0 font-mono text-xs font-semibold tabular-nums ${scoreTone(score)}`}>
            {score}%
          </span>
        )}
      </Link>
    )
  }

  /* ---------------------------------------------------------------- list */
  if (variant === 'list') {
    return (
      <Link
        href={href}
        className={`group surface flex gap-4 p-3 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04] ${className}`}
      >
        <div className="poster-shadow relative h-[128px] w-[88px] shrink-0 overflow-hidden rounded-md bg-base-700">
          {poster && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={title}
              loading="lazy"
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="grid h-full w-full place-items-center p-2 text-center text-[10px] text-zinc-600">
              {title}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 font-display text-sm font-semibold text-zinc-100 group-hover:text-accent-soft sm:text-base">
              {title}
            </h3>
            <span className="shrink-0">{WatchToggle}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="chip">{formatLabel(media.format)}</span>
            {media.seasonYear && <span className="chip">{media.seasonYear}</span>}
            {score != null && (
              <span className="chip chip-accent">
                <IconStar size={10} />
                {(score / 10).toFixed(1)}
              </span>
            )}
            {media.episodes != null && <span className="chip">{media.episodes} ep</span>}
            {media.status === 'RELEASING' && <span className="chip chip-live">Airing</span>}
          </div>

          {media.genres?.length ? (
            <p className="mt-2 truncate text-xs text-zinc-600">{media.genres.join(' · ')}</p>
          ) : null}

          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {(media.description ?? '').replace(/<[^>]+>/g, '').slice(0, 240) || 'No synopsis yet.'}
          </p>
        </div>
      </Link>
    )
  }

  /* -------------------------------------------------------------- banner */
  if (variant === 'banner') {
    return (
      <Link
        href={href}
        className={`group relative block overflow-hidden rounded-lg border border-white/[0.07] ${className}`}
      >
        <div className="relative aspect-[16/7] w-full bg-base-800">
          {media.bannerImage || poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.bannerImage ?? poster}
              alt=""
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-base via-base/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            {rank != null && (
              <p className="eyebrow mb-1.5">#{rank} trending</p>
            )}
            <h3 className="line-clamp-2 font-display text-lg font-bold tracking-tight text-white sm:text-2xl">
              {title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400 sm:text-sm">
              {(media.description ?? '').replace(/<[^>]+>/g, '').slice(0, 160)}
            </p>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="chip">{formatLabel(media.format)}</span>
              {media.seasonYear && <span className="chip">{media.seasonYear}</span>}
              {score != null && (
                <span className="chip chip-accent">
                  <IconStar size={10} />
                  {(score / 10).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  /* ------------------------------------------------------------ continue */
  if (variant === 'continue') {
    const p = get(media.id)
    const pct = p && p.duration ? Math.min(100, (p.position / p.duration) * 100) : 0
    const ep = p?.episode ?? 1
    return (
      <Link href={`/watch/${media.id}/${ep}`} className={`group block ${className}`}>
        <div className="poster-shadow relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-base-800">
          {poster && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={title}
              loading="lazy"
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/25 to-transparent" />
          <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-base-900 shadow-xl">
              <IconPlay size={17} />
            </span>
          </span>
          <span className="absolute left-2 top-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-white backdrop-blur">
            EP {ep}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-2">
            <p className="line-clamp-1 text-xs font-medium text-white">{title}</p>
            <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </Link>
    )
  }

  /* ---------------------------------------------------------------- grid */
  return (
    <Link href={href} className={`group block ${className}`}>
      <div className="poster-shadow relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-base-800">
        {poster && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center p-3 text-center text-xs text-zinc-600">
            {title}
          </div>
        )}

        {/* Scrim only strengthens on hover, so posters stay bright at rest. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-60 transition group-hover:opacity-95" />

        <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-base-900 shadow-xl">
            <IconPlay size={17} />
          </span>
        </span>

        <div className="absolute right-2 top-2">{WatchToggle}</div>

        {score != null && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold backdrop-blur">
            <IconStar size={10} className={scoreTone(score)} />
            <span className={scoreTone(score)}>{(score / 10).toFixed(1)}</span>
          </span>
        )}

        {media.status === 'RELEASING' && media.nextAiringEpisode && (
          <span className="absolute bottom-2 left-2 rounded bg-signal/90 px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-base-900">
            EP {media.nextAiringEpisode.episode} soon
          </span>
        )}

        {progressPct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/60">
            <div className="h-full bg-accent" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-zinc-100 transition-colors group-hover:text-accent-soft">
          {title}
        </h3>
        <p className="mt-0.5 truncate font-mono text-[0.65rem] text-zinc-600">
          {formatLabel(media.format)}
          {media.seasonYear ? ` · ${media.seasonYear}` : ''}
          {total ? ` · ${total} EP` : ''}
        </p>
      </div>
    </Link>
  )
}
