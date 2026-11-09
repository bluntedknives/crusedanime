'use client'

import { useEffect, useState } from 'react'
import { estimateStorage, formatBytes, useDownloads, type StorageEstimate } from '@/lib/downloads'
import { getPrefs } from '@/lib/store'
import { IconCheck, IconCloudOff } from './icons'

/**
 * Storage meter for offline downloads.
 *
 * Two numbers, deliberately separate: the bytes downloads occupy (ours, and
 * what the cap governs) and the browser's own origin usage/quota, which also
 * counts the service-worker caches. Showing one as if it were the other would
 * make the cap look broken, so they are labelled apart.
 */
export default function StorageMeter({ className = '' }: { className?: string }) {
  const { list } = useDownloads()
  const [est, setEst] = useState<StorageEstimate | null>(null)

  // Re-measure whenever the library changes: sizes settle as downloads finish.
  useEffect(() => {
    let alive = true
    void estimateStorage().then((e) => {
      if (alive) setEst(e)
    })
    return () => {
      alive = false
    }
  }, [list])

  const used = est?.usedBytes ?? 0
  const quota = est?.quotaBytes ?? null
  const capMb = getPrefs().downloadCapMb
  const capBytes = capMb > 0 ? capMb * 1024 * 1024 : null

  // The bar tracks the tighter of the cap and the browser quota, so it reflects
  // whichever limit will actually stop the next download.
  const denom = capBytes ?? quota
  const pct = denom ? Math.min(100, (used / denom) * 100) : 0
  const nearFull = denom != null && used / denom > 0.9

  return (
    <div className={`surface p-4 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="label mb-0">Offline storage</span>
        <span className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
          {formatBytes(used)}
          {capBytes ? ` of ${capMb} MB cap` : quota ? ` of ${formatBytes(quota)}` : ''}
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] ${nearFull ? 'bg-amber-400' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
        {est?.persisted ? (
          <>
            <IconCheck size={13} className="text-emerald-400" />
            Kept on this device — the browser will not clear it automatically.
          </>
        ) : (
          <>
            <IconCloudOff size={13} />
            Best-effort storage — the browser may clear downloads when space runs low.
          </>
        )}
      </p>
    </div>
  )
}
