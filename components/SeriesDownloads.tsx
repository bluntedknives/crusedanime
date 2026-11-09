'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatBytes, localKeyFor, requestPersistence, useDownloads, type DownloadInput } from '@/lib/downloads'
import type { EpisodeInfo } from '@/lib/consumet'
import { IconCheck, IconCloudOff, IconDownload, IconPlay, IconRefresh, IconTrash } from './icons'

interface Props {
  animeId: number
  animeTitle: string
  poster: string
  malId: number | null
  genres?: string[]
  episodes: EpisodeInfo[]
  totalEpisodes: number | null
  type: 'sub' | 'dub'
}

/**
 * Offline section for a series.
 *
 * Shows which episodes of this series are saved and offers a one-tap batch
 * download for the rest. The batch rides the shared download queue, so it keeps
 * draining after the viewer navigates away, and re-running it only picks up the
 * episodes that are still missing.
 */
export default function SeriesDownloads({
  animeId,
  animeTitle,
  poster,
  malId,
  genres,
  episodes,
  totalEpisodes,
  type,
}: Props) {
  const { get, queue, cancelSeries, remove } = useDownloads()
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [confirmingBatch, setConfirmingBatch] = useState(false)

  /** Above this, a batch asks once more — a 1000-episode title is one tap away. */
  const BATCH_CONFIRM_ABOVE = 25

  const rows = useMemo(
    () =>
      episodes.map((ep) => ({
        ep,
        key: localKeyFor(animeId, ep.number, type),
      })),
    [episodes, animeId, type],
  )

  const saved = rows.filter((r) => get(r.key)?.status === 'ready')
  const inFlight = rows.filter((r) => {
    const s = get(r.key)?.status
    return s === 'queued' || s === 'downloading'
  })
  const missing = rows.filter((r) => {
    const s = get(r.key)?.status
    return s !== 'ready' && s !== 'queued' && s !== 'downloading'
  })

  const savedBytes = saved.reduce((n, r) => n + (get(r.key)?.bytes ?? 0), 0)

  const startBatch = () => {
    // A large run is a long download and a lot of storage; make the second tap
    // explicit rather than starting 1000 episodes from one press.
    if (missing.length > BATCH_CONFIRM_ABOVE && !confirmingBatch) {
      setConfirmingBatch(true)
      return
    }
    setConfirmingBatch(false)
    void requestPersistence()
    // Only the missing ones: episodes already stored or queued are skipped by
    // the queue itself, so this is safe to tap again after new episodes appear.
    const inputs: DownloadInput[] = missing.map((r) => ({
      animeId,
      animeTitle,
      poster,
      episode: r.ep.number,
      totalEpisodes,
      type,
      malId,
      genres,
    }))
    queue(inputs)
  }

  if (!episodes.length) return null

  return (
    <section id="downloads">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Offline</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {saved.length
              ? `${saved.length} saved${savedBytes ? ` · ${formatBytes(savedBytes)}` : ''}`
              : 'Save episodes to watch with no connection'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {missing.length > 0 && (
            <button type="button" onClick={startBatch} className="btn-ghost h-9 px-3 text-xs">
              <IconDownload size={14} />
              {confirmingBatch
                ? `Tap again to download ${missing.length} episodes`
                : saved.length
                  ? `Download ${missing.length} remaining`
                  : `Download all${missing.length > BATCH_CONFIRM_ABOVE ? ` (${missing.length})` : ''}`}
            </button>
          )}
          {(inFlight.length > 0 || saved.length > 0) && (
            <button
              type="button"
              onClick={() => {
                if (confirmingClear) {
                  cancelSeries(animeId, type)
                  setConfirmingClear(false)
                } else {
                  setConfirmingClear(true)
                }
              }}
              className="btn-ghost h-9 px-3 text-xs text-red-300 hover:bg-red-500/10"
            >
              {confirmingClear ? 'Tap again to clear' : 'Clear downloads'}
            </button>
          )}
        </div>
      </div>

      {/* Only the episodes that have a download, so the list stays short. */}
      {saved.length === 0 && inFlight.length === 0 ? (
        <p className="flex items-center gap-1.5 py-3 text-xs text-zinc-500">
          <IconCloudOff size={13} />
          Nothing saved for this title yet.
        </p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {[...inFlight, ...saved].map(({ ep, key }) => {
            const entry = get(key)
            const pct = Math.round((entry?.progress ?? 0) * 100)
            const watchHref = `/watch/${animeId}/${ep.number}${type === 'dub' ? '?type=dub' : ''}`
            return (
              <li
                key={key}
                className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-base-850/60 p-2"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/5 font-mono text-[11px] text-zinc-300">
                  {ep.number}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-zinc-100">
                    Episode {ep.number}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.6rem] uppercase tracking-wide text-zinc-500">
                    {entry?.status === 'ready'
                      ? formatBytes(entry.bytes)
                      : entry?.status === 'queued'
                        ? 'Queued'
                        : entry?.status === 'error'
                          ? 'Failed'
                          : `${pct}%`}
                  </span>
                  {entry?.status === 'downloading' && (
                    <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </span>

                {entry?.status === 'ready' ? (
                  <Link href={watchHref} className="btn-ghost h-8 px-2.5 text-xs">
                    <IconPlay size={13} />
                    Play
                  </Link>
                ) : entry?.status === 'error' ? (
                  <button
                    type="button"
                    onClick={startBatch}
                    aria-label={`Retry episode ${ep.number}`}
                    className="btn-icon h-8 w-8 text-zinc-400 hover:text-zinc-100"
                  >
                    <IconRefresh size={14} />
                  </button>
                ) : (
                  <span className="grid h-8 w-8 place-items-center text-accent-soft">
                    <IconCheck size={14} className="opacity-40" />
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => void remove(key)}
                  aria-label={`Remove episode ${ep.number} download`}
                  className="btn-icon h-8 w-8 text-zinc-500 hover:text-red-300"
                >
                  <IconTrash size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
