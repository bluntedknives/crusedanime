'use client'

import { useState } from 'react'

interface Props {
  trailer: { id: string | null; site: string | null } | null
  title: string
}

export default function TrailerEmbed({ trailer, title }: Props) {
  const [playing, setPlaying] = useState(false)

  if (!trailer?.id || !trailer.site) return null

  const isYouTube = trailer.site.toLowerCase() === 'youtube'
  if (!isYouTube) return null

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Trailer</h2>
        <a
          href={`https://www.youtube.com/watch?v=${trailer.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[11px] text-brand-soft hover:text-brand"
        >
          Open on YouTube ↗
        </a>
      </div>

      <div className="relative aspect-video w-full bg-black">
        {playing ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${trailer.id}?autoplay=1&rel=0`}
            title={`${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative h-full w-full"
            aria-label={`Play ${title} trailer`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${trailer.id}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white shadow-2xl transition group-hover:scale-110">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
    </section>
  )
}
