'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { IconCloudOff, IconDownload, IconPlay, IconTrash } from '@/components/icons'
import StorageMeter from '@/components/StorageMeter'
import { formatBytes, useDownloads } from '@/lib/downloads'

/**
 * Downloads library.
 *
 * Everything here reads from localStorage metadata; the media itself lives in
 * Cache Storage and is served by the service worker. So this page works offline
 * too, and deleting a row only has to clear the cache entries.
 */
export default function DownloadsPage() {
  const { list, remove } = useDownloads()

  const { ready, bytes } = useMemo(() => {
    let ready = 0
    let bytes = 0
    for (const d of list) {
      if (d.status === 'ready') ready += 1
      bytes += d.bytes || 0
    }
    return { ready, bytes }
  }, [list])

  return (
    <div className="container-page pt-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Available offline</p>
          <h1 className="text-xl font-bold tracking-tight text-zinc-50 sm:text-2xl">Downloads</h1>
        </div>
        {list.length > 0 && (
          <p className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
            {ready} {ready === 1 ? 'episode' : 'episodes'} · {formatBytes(bytes)}
          </p>
        )}
      </div>

      {list.length === 0 ? (
        <div className="surface grid place-items-center px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-accent-soft">
            <IconDownload size={26} />
          </span>
          <h2 className="mt-4 text-base font-semibold text-zinc-100">Nothing downloaded yet</h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-400">
            Open an episode and tap <span className="font-medium text-zinc-200">Download</span> to
            save it. Downloaded episodes play with no connection — on a bus, a flight, anywhere.
          </p>
          <Link href="/search" className="btn-primary mt-5 h-10 px-4">
            Browse anime
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {list.map((d) => {
            const pct = Math.round((d.progress ?? 0) * 100)
            const watchHref = `/watch/${d.animeId}/${d.episode}${d.type === 'dub' ? '?type=dub' : ''}`
            return (
              <li key={d.key} className="surface flex items-center gap-3 p-2.5">
                <Link
                  href={watchHref}
                  className="h-[72px] w-[50px] shrink-0 overflow-hidden rounded bg-base-700"
                  aria-label={`Play ${d.animeTitle} episode ${d.episode}`}
                >
                  {d.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.poster} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={watchHref}
                    className="line-clamp-1 text-sm font-semibold text-zinc-100 transition-colors hover:text-accent-soft"
                  >
                    {d.animeTitle}
                  </Link>
                  <p className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
                    EP {d.episode} · {d.type}
                    {d.status === 'ready' ? ` · ${formatBytes(d.bytes)}` : ''}
                  </p>

                  {d.status === 'downloading' && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-accent transition-[width]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[0.6rem] text-zinc-500">{pct}%</span>
                    </div>
                  )}

                  {d.status === 'error' && (
                    <p className="mt-1 line-clamp-1 text-xs text-red-300">
                      Failed — {d.error ?? 'download error'}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {d.status === 'ready' && (
                    <Link href={watchHref} className="btn-ghost h-9 px-3 text-xs">
                      <IconPlay size={14} />
                      Play
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(d.key)}
                    aria-label={`Delete download of ${d.animeTitle} episode ${d.episode}`}
                    className="btn-icon h-9 w-9 text-zinc-400 hover:text-red-300"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {list.length > 0 && (
        <>
          <StorageMeter className="mt-5" />
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-600">
            <IconCloudOff size={13} />
            Downloads stay on this device and play without a connection.
          </p>
        </>
      )}
    </div>
  )
}
