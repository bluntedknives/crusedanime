'use client'

import Link from 'next/link'
import { IconClose, IconPlay } from './icons'
import { useProgress, formatTime } from '@/lib/store'

/**
 * Continue-watching rail. Reads progress straight from localStorage, so it
 * renders nothing on the server and appears once the client hydrates.
 */
export default function ContinueWatching() {
  const { continueWatching, remove } = useProgress()

  if (!continueWatching.length) return null

  return (
    <section className="animate-fade-up">
      <div className="container-page mb-3">
        <h2 className="section-title">Continue watching</h2>
      </div>

      <div className="scrollbar-none flex gap-3 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8">
        {continueWatching.map((p) => {
          const pct = p.duration ? Math.min(100, (p.position / p.duration) * 100) : 0
          const remaining = Math.max(0, p.duration - p.position)
          return (
            <div key={`${p.animeId}:${p.type}`} className="group/cw relative w-[240px] shrink-0 sm:w-[280px]">
              <Link href={`/watch/${p.animeId}/${p.episode}${p.type === 'dub' ? '?type=dub' : ''}`}>
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/[0.07] bg-base-800">
                  {p.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.poster}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover opacity-85 transition duration-500 group-hover/cw:scale-105"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                  <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover/cw:opacity-100">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/95 text-white shadow-xl">
                      <IconPlay size={16} />
                    </span>
                  </span>

                  <span className="absolute left-2 top-2 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-white backdrop-blur">
                    EP {p.episode}
                    {p.type === 'dub' ? ' · DUB' : ''}
                  </span>

                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="line-clamp-1 text-xs font-medium text-white">{p.title}</p>
                    <p className="mt-0.5 font-mono text-[0.6rem] text-zinc-400">
                      {formatTime(remaining)} left
                    </p>
                    <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/25">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => remove(p.animeId)}
                aria-label={`Remove ${p.title} from continue watching`}
                className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-black/75 text-zinc-300 opacity-0 backdrop-blur transition hover:bg-black hover:text-white group-hover/cw:opacity-100"
              >
                <IconClose size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
