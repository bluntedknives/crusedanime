'use client'

import { useState } from 'react'
import { EMBED_PROVIDERS, embedUrl, type EmbedSlot } from '@/lib/embed'
import type { Media } from '@/lib/anilist'
import { IconPlay } from './icons'

/**
 * Third-party player, rendered as a frame.
 *
 * The iframe is not mounted until the viewer asks for it. Mounting it eagerly
 * would fire the provider's player, its trackers and its ad frames on page load
 * for every film, and the providers are not trustworthy enough to run before
 * someone has chosen to watch. The poster stays up until then.
 *
 * The provider picker is not decoration: these hosts fail independently, so
 * when one shows an error the next is one click away.
 *
 * A blocked frame cannot be detected from here: the host's block page is served
 * cross-origin with a normal 200, so `load` fires exactly as it would for a
 * working player and the DOM stays unreadable either way. Rather than fake a
 * detection we cannot make, the notice below states plainly what a block page
 * means, so a network-level block is never mistaken for an app fault.
 */
export default function EmbedPlayer({
  media,
  slot,
  title,
  poster,
  covered,
}: {
  media: Media
  slot: EmbedSlot
  title: string
  poster: string | null
  covered: boolean
}) {
  const [providerId, setProviderId] = useState(EMBED_PROVIDERS[0].id)
  const [started, setStarted] = useState(false)

  const src = embedUrl(media, slot, providerId)
  const active = EMBED_PROVIDERS.find((p) => p.id === providerId) ?? EMBED_PROVIDERS[0]

  if (!src) {
    return (
      <div className="surface grid aspect-video place-items-center p-6 text-center">
        <p className="text-sm text-zinc-400">This title has no external source to play.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {started ? (
          <iframe
            key={src}
            src={src}
            title={covered ? 'Player' : title}
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
          />
        ) : (
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="group relative h-full w-full"
            aria-label="Load player"
          >
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" className="h-full w-full object-cover opacity-60" />
            ) : null}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-accent/90 text-white transition-transform group-hover:scale-105">
                <IconPlay className="h-6 w-6 translate-x-[1px]" />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-left">
              <span className="block text-xs text-zinc-300">
                {covered
                  ? 'External player · loads on request'
                  : `Load external player · ${active.name}`}
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[0.6rem] uppercase tracking-wider text-zinc-600">
          {covered ? 'Source' : 'Provider'}
        </span>
        {EMBED_PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setProviderId(p.id)
              setStarted(true)
            }}
            className={[
              'rounded-md px-2 py-1 text-[0.7rem] transition-colors',
              p.id === providerId
                ? 'bg-accent/20 text-accent-soft'
                : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300',
            ].join(' ')}
          >
            {p.name}
          </button>
        ))}
      </div>

      {!covered && (
        <div className="space-y-1">
          <p className="text-[0.7rem] leading-relaxed text-zinc-600">
            Served by a third-party host from its own origin. If one source fails to load, try
            another above.
          </p>
          <p className="text-[0.7rem] leading-relaxed text-zinc-600">
            If the frame shows a block or “access denied” page, the network this device is on is
            filtering <span className="text-zinc-500">{active.name}</span>. That is a network
            block, not a fault in this app — the same frame plays on an unfiltered network.
          </p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-block font-mono text-[0.65rem] uppercase tracking-wider text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline"
          >
            Open {active.name} directly ↗
          </a>
        </div>
      )}
    </div>
  )
}
