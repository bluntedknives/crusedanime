'use client'

import { useEffect, useRef, useState } from 'react'

import { coverLabel } from '@/lib/cover'

interface Props {
  trailer: { id: string | null; site: string | null } | null
  title: string
  covered?: boolean
}

/**
 * Trailer that plays itself.
 *
 * There is no click-to-play poster gate: the frame starts muted as soon as the
 * section is on screen. Autoplay is only attempted once the section scrolls
 * into view, so a trailer below the fold does not pull video the viewer never
 * looks at. Browsers only permit unmuted autoplay after a user gesture, so the
 * frame starts muted and the sound button unmutes it on demand.
 */
export default function TrailerEmbed({ trailer, title, covered = false }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    // Browsers without IntersectionObserver get the frame straight away rather
    // than nothing at all.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!trailer?.id || !trailer.site) return null
  if (trailer.site.toLowerCase() !== 'youtube') return null

  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted ? '1' : '0',
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
  })
  // Without `origin` YouTube treats the embed as an unverifiable client and can
  // refuse to play it. Only meaningful in the browser, so it is added on mount.
  if (typeof window !== 'undefined') params.set('origin', window.location.origin)

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">{coverLabel('Trailer', covered)}</h2>
        <a
          href={`https://www.youtube.com/watch?v=${trailer.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[11px] text-accent-soft hover:text-accent"
        >
          Open on YouTube ↗
        </a>
      </div>

      <div ref={boxRef} className="relative aspect-video w-full bg-black">
        {inView ? (
          <>
            <iframe
              key={muted ? 'muted' : 'unmuted'}
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${trailer.id}?${params.toString()}`}
              title={`${title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="absolute bottom-2 left-2 z-10 rounded-md border border-white/15 bg-black/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200 backdrop-blur transition hover:border-accent/50 hover:text-white"
            >
              {muted ? 'Sound on' : 'Mute'}
            </button>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://i.ytimg.com/vi/${trailer.id}/hqdefault.jpg`}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>
    </section>
  )
}
