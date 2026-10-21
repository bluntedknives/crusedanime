'use client'

import { titleOf, type Media } from '@/lib/anilist'

/**
 * AniList does not expose the stylised title logos used on its own pages, and
 * the community logo CDN is unreliable, so this renders a type-led lockup from
 * the title text instead: heavy display type with the native title underneath
 * when it differs. Unlike a remote image, it always resolves.
 */
export default function TitleLogo({ media, className = '' }: { media: Media; className?: string }) {
  const title = titleOf(media)
  const native = media.title.native
  const showNative = Boolean(native && native !== title)

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <h1 className="text-balance font-display text-3xl font-bold leading-[1.03] tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)] sm:text-4xl lg:text-[3.25rem]">
        {title}
      </h1>
      {showNative && (
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/45">
          {native}
        </p>
      )}
    </div>
  )
}
