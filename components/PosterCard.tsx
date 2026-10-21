'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  formatLabel,
  posterOf,
  scoreOf,
  seasonLabel,
  titleOf,
  type Media,
} from '@/lib/anilist'
import { useWatchlist } from '@/lib/store'

type Variant = 'grid' | 'list' | 'compact' | 'banner'

interface Props {
  media: Media
  variant?: Variant
  /** Episodes already watched, drawn from local progress. */
  watchedEpisodes?: number
  className?: string
}

export default function PosterCard({
  media,
  variant = 'grid',
  watchedEpisodes = 0,
  className = '',
}: Props) {
  const { has, toggle } = useWatchlist()
  const [imgOk, setImgOk] = useState(true)

  const title = titleOf(media)
  const poster = posterOf(media)
  const score = scoreOf(media)
  const href = `/anime/${media.id}`
  const inList = has(media.id)

  const total = media.episodes ?? 0
  const progressPct = total > 0 && watchedEpisodes > 0 ? Math.min(100, (watchedEpisodes / total) * 100) : 0

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
        'grid h-8 w-8 place-items-center rounded-full border text-sm backdrop-blur transition',
        inList
          ? 'border-brand/70 bg-brand/90 text-white'
          : 'border-white/15 bg-black/50 text-zinc-200 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
      ].join(' ')}
    >
      {inList ? '✓' : '+'}
    </button>
  )

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className={`group flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/5 ${className}`}
      >
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-ink-700">
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
          <p className="truncate text-sm font-medium text-zinc-100 group-hover:text-brand-soft">
            {title}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {formatLabel(media.format)} · {seasonLabel(media.season, media.seasonYear)}
          </p>
        </div>
        {score != null && (
          <span className="shrink-0 text-xs font-semibold text-amber-400">{score}%</span>
        )}
      </Link>
    )
  }

  if (variant === 'list') {
    return (
      <Link
        href={href}
        className={`group surface flex gap-4 p-3 transition hover:border-white/15 hover:bg-ink-800 ${className}`}
      >
        <div className="relative h-[132px] w-[92px] shrink-0 overflow-hidden rounded-lg bg-ink-700 poster-shadow">
          {poster && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={title}
              loading="lazy"
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center px-2 text-center text-[10px] text-zinc-500">
              {title}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100 group-hover:text-brand-soft sm:text-base">
              {title}
            </h3>
            <span className="shrink-0">{WatchToggle}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="chip">{formatLabel(media.format)}</span>
            {media.seasonYear && <span className="chip">{media.seasonYear}</span>}
            {score != null && (
              <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-300">
                ★ {(score / 10).toFixed(1)}
              </span>
            )}
            {media.episodes != null && <span className="chip">{media.episodes} ep</span>}
            {media.status === 'RELEASING' && (
              <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                Airing
              </span>
            )}
          </div>

          {media.genres?.length ? (
            <p className="mt-2 truncate text-xs text-zinc-500">{media.genres.join(' · ')}</p>
          ) : null}

          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-400">
            {(media.description ?? '').replace(/<[^>]+>/g, '').slice(0, 260) || 'No synopsis yet.'}
          </p>
        </div>
      </Link>
    )
  }

  if (variant === 'banner') {
    return (
      <Link href={href} className={`group relative block overflow-hidden rounded-2xl ${className}`}>
        <div className="relative aspect-[16/7] w-full bg-ink-800">
          {media.bannerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.bannerImage}
              alt=""
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            />
          ) : poster && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover blur-sm"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-brand-soft">
              <span>#{1}</span>
              <span className="text-zinc-400">Trending now</span>
            </div>
            <h3 className="line-clamp-2 text-xl font-bold text-white sm:text-2xl">{title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-300 sm:text-sm">
              {(media.description ?? '').replace(/<[^>]+>/g, '').slice(0, 180)}
            </p>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={href} className={`group block ${className}`}>
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-ink-800 poster-shadow">
        {poster && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center p-3 text-center text-xs text-zinc-500">
            {title}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-80 transition group-hover:opacity-100" />

        <div className="absolute right-2 top-2">{WatchToggle}</div>

        {score != null && (
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur">
            ★ {(score / 10).toFixed(1)}
          </span>
        )}

        {media.status === 'RELEASING' && media.nextAiringEpisode && (
          <span className="absolute bottom-2 left-2 rounded-md bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            EP {media.nextAiringEpisode.episode} soon
          </span>
        )}

        {progressPct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
            <div className="h-full bg-brand" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-zinc-100 group-hover:text-brand-soft">
          {title}
        </h3>
        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
          {formatLabel(media.format)}
          {media.seasonYear ? ` · ${media.seasonYear}` : ''}
          {total ? ` · ${total} ep` : ''}
        </p>
      </div>
    </Link>
  )
}
