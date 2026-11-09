'use client'

import { useState } from 'react'
import { IconCheck, IconClose, IconDownload, IconRefresh } from './icons'
import {
  formatBytes,
  localKeyFor,
  requestPersistence,
  useDownloads,
  type DownloadInput,
} from '@/lib/downloads'

interface Props {
  animeId: number
  animeTitle: string
  poster: string
  episode: number
  totalEpisodes: number | null
  type: 'sub' | 'dub'
  malId?: number | null
  genres?: string[]
  intro?: { start: number; end: number } | null
  outro?: { start: number; end: number } | null
  subtitleTracks?: { label: string; lang: string }[]
}

/**
 * Download / progress / delete control for one episode.
 *
 * One control with three faces rather than a menu: idle, in-flight (tap to
 * cancel), and stored (tap to remove). Removal is destructive, so it arms on
 * the first tap and only deletes on the second.
 */
export default function DownloadButton({
  animeId,
  animeTitle,
  poster,
  episode,
  totalEpisodes,
  type,
  malId,
  genres,
  intro,
  outro,
  subtitleTracks,
}: Props) {
  const { get, download, remove, cancel } = useDownloads()
  const [confirming, setConfirming] = useState(false)

  const key = localKeyFor(animeId, episode, type)
  const entry = get(key)
  const status = entry?.status

  const start = async () => {
    // Best-effort: ask the browser to keep the bytes before they are written.
    void requestPersistence()
    const input: DownloadInput = {
      animeId,
      animeTitle,
      poster,
      episode,
      totalEpisodes,
      type,
      malId,
      genres,
      intro,
      outro,
      subtitleTracks,
    }
    await download(input)
  }

  if (status === 'downloading') {
    const pct = Math.round((entry?.progress ?? 0) * 100)
    return (
      <button
        type="button"
        onClick={() => cancel(key)}
        title="Cancel download"
        className="btn-ghost h-9 px-3 text-xs"
      >
        <span className="relative grid h-3.5 w-3.5 place-items-center">
          <svg viewBox="0 0 36 36" className="h-3.5 w-3.5 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="6" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${pct * 0.9425} 94.25`}
            />
          </svg>
        </span>
        {pct}%
      </button>
    )
  }

  if (status === 'ready') {
    if (confirming) {
      return (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              void remove(key)
              setConfirming(false)
            }}
            className="btn-ghost h-9 px-3 text-xs text-red-300 hover:bg-red-500/10"
          >
            Delete {formatBytes(entry?.bytes ?? 0)}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            aria-label="Keep download"
            className="btn-icon h-9 w-9"
          >
            <IconClose size={14} />
          </button>
        </span>
      )
    }
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title="Downloaded — tap to remove"
        className="btn-ghost h-9 px-3 text-xs border-accent/40 bg-accent/10 text-accent-soft"
      >
        <IconCheck size={14} />
        Downloaded
      </button>
    )
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={start}
        title={entry?.error ? `Download failed: ${entry.error}` : 'Retry download'}
        className="btn-ghost h-9 px-3 text-xs text-red-300 hover:bg-red-500/10"
      >
        <IconRefresh size={14} />
        Retry download
      </button>
    )
  }

  return (
    <button type="button" onClick={start} title="Save for offline" className="btn-ghost h-9 px-3 text-xs">
      <IconDownload size={14} />
      Download
    </button>
  )
}
