'use client'

import { useRef, useState } from 'react'
import { IconDownload, IconUpload } from './icons'
import { exportBackup, importBackup, useProgress, useWatchlist } from '@/lib/store'

/**
 * Export and restore the local library.
 *
 * Everything this app knows about a viewer lives in localStorage, which means a
 * cleared browser profile loses all of it. A file export is the only way out,
 * so it is worth exposing plainly rather than burying it.
 */
export default function BackupPanel() {
  const { entries } = useWatchlist()
  const { all } = useProgress()
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [replace, setReplace] = useState(false)

  const counts = {
    watchlist: entries.length,
    progress: Object.keys(all).length,
  }

  const onExport = () => {
    const backup = exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `crused-backup-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setStatus({
      ok: true,
      message: `Exported ${counts.watchlist} watchlist and ${counts.progress} progress entries.`,
    })
  }

  const onFile = async (file: File) => {
    const text = await file.text()
    const result = importBackup(text, replace ? 'replace' : 'merge')
    setStatus({ ok: result.ok, message: result.message })
  }

  return (
    <div className="px-3 pb-3">
      <span className="label">Backup</span>
      <p className="mb-2 text-xs leading-relaxed text-zinc-500">
        Your watchlist, progress, history and ratings are stored only in this browser. Export a file
        to keep them, or to move them to another device.
      </p>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={onExport} className="btn-ghost gap-1.5 text-xs">
          <IconDownload size={15} />
          Export
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="btn-ghost gap-1.5 text-xs"
        >
          <IconUpload size={15} />
          Import
        </button>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent,#7c5cff)]"
          />
          Replace instead of merge
        </label>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onFile(file)
          // Reset so importing the same filename twice still fires a change.
          e.target.value = ''
        }}
      />

      {status && (
        <p
          role="status"
          className={[
            'mt-2 rounded-lg border px-2.5 py-2 text-xs',
            status.ok
              ? 'border-signal/30 bg-signal/10 text-signal'
              : 'border-red-500/30 bg-red-500/10 text-red-300',
          ].join(' ')}
        >
          {status.message}
        </p>
      )}
    </div>
  )
}
