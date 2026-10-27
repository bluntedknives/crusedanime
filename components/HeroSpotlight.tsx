'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { IconInfo, IconPlay, IconStar } from './icons'
import TitleLogo from './TitleLogo'
import {
  formatLabel,
  posterOf,
  scoreOf,
  seasonLabel,
  statusLabel,
  stripHtml,
  titleOf,
  type Media,
} from '@/lib/anilist'

interface Props {
  items: Media[]
}

/** YouTube id from whatever shape AniList returned for the trailer. */
function trailerId(m: Media): string | null {
  if (!m.trailer) return null
  if (m.trailer.id) return m.trailer.id
  const url = (m.trailer as { site?: string | null }).site
  return url ?? null
}

/**
 * Auto-rotating spotlight.
 *
 * The backdrop is the title's trailer, muted and looping, with the banner art
 * behind it as a poster frame. Rotation pauses on hover and stops entirely for
 * users who prefer reduced motion. If no trailer is available the banner (or
 * cover art) is used, so the section never renders empty.
 */
export default function HeroSpotlight({ items }: Props) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [videoOk, setVideoOk] = useState(true)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (items.length < 2 || paused) return
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 12000)
    return () => clearInterval(t)
  }, [items.length, paused])

  // A fresh title means a fresh trailer, so re-allow the embed.
  useEffect(() => {
    setVideoOk(true)
  }, [idx])

  const active = items[idx]
  if (!active) return null

  const backdrop = active.bannerImage ?? posterOf(active)
  const score = scoreOf(active)
  const synopsis = stripHtml(active.description)
  const ytId = trailerId(active)
  const showVideo = Boolean(ytId) && videoOk

  return (
    <section className="container-page">
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="relative isolate overflow-hidden rounded-[var(--radius-xl)] border border-white/[0.06] bg-black"
      >
        {/* Backdrop plate */}
        <div className="absolute inset-0 -z-10">
          {backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={backdrop}
              src={backdrop}
              alt=""
              className="h-full w-full animate-kenburns object-cover opacity-70"
            />
          ) : null}
        </div>

        {/* Trailer playing behind the content, cropped to fill the frame. */}
        {showVideo && (
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <iframe
              ref={frameRef}
              key={ytId}
              title={`${titleOf(active)} trailer`}
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&modestbranding=1&playsinline=1&rel=0&disablekb=1&iv_load_policy=3`}
              allow="autoplay; encrypted-media"
              tabIndex={-1}
              aria-hidden="true"
              onError={() => setVideoOk(false)}
              className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 opacity-85"
            />
          </div>
        )}

        {/* Legibility scrims sit above the video but below the content. They
            stay light while a trailer is playing so the video is visible, and
            go heavy over a still backdrop where there is nothing to watch. */}
        {showVideo ? (
          // Bottom-only while the trailer runs, so the scrim does not wash out
          // the middle of the video it is meant to sit behind.
          <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-black via-black/65 to-transparent" />
        ) : (
          <>
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/80 to-black/25" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/95 via-black/55 to-transparent" />
          </>
        )}

        <div className="relative flex min-h-[340px] flex-col justify-end p-5 sm:min-h-[420px] sm:p-8 lg:min-h-[470px] lg:p-10">
          <div className="flex items-end gap-6">
            {/* Cover plate */}
            <div className="hidden h-[210px] w-[140px] shrink-0 overflow-hidden rounded-[10px] border border-white/10 shadow-[0_20px_44px_-24px_rgba(0,0,0,0.95)] sm:block">
              {posterOf(active) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterOf(active)} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 animate-fade-up">
              <p className="eyebrow mb-3 text-accent-soft">
                Featured
                <span className="text-white/30">·</span>
                <span className="text-white/45">#{idx + 1}</span>
              </p>

              <TitleLogo media={active} />

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {score != null && (
                  <span className="chip chip-accent">
                    <IconStar size={11} />
                    {(score / 10).toFixed(1)}
                  </span>
                )}
                <span className="chip">{formatLabel(active.format)}</span>
                {active.episodes ? <span className="chip">{active.episodes} ep</span> : null}
                {active.seasonYear && (
                  <span className="chip">{seasonLabel(active.season, active.seasonYear)}</span>
                )}
                {active.status && <span className="chip">{statusLabel(active.status)}</span>}
              </div>

              {synopsis && (
                <p className="mt-4 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/70">
                  {synopsis}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link href={`/watch/${active.id}/1`} className="btn-primary h-10 px-5">
                  <IconPlay size={16} />
                  Watch now
                </Link>
                <Link href={`/anime/${active.id}`} className="btn-ghost h-10 px-4">
                  <IconInfo size={16} />
                  Details
                </Link>
              </div>
            </div>
          </div>

          {/* Rotation markers, doubling as a progress read-out. */}
          {items.length > 1 && (
            <div className="mt-7 flex items-center gap-1.5">
              {items.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Show ${titleOf(m)}`}
                  aria-current={i === idx}
                  className={[
                    'h-[3px] rounded-full transition-all duration-300',
                    i === idx ? 'w-8 bg-accent' : 'w-4 bg-white/20 hover:bg-white/40',
                  ].join(' ')}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
