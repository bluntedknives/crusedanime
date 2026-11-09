'use client'

import Link from 'next/link'
import { IconCloudOff, IconRefresh } from '@/components/icons'

/**
 * Offline fallback.
 *
 * Precached by the service worker and served for any navigation that cannot
 * reach the network. It is intentionally tiny and dependency-free so it renders
 * from the cache alone. "Try again" reloads; the app shell, watchlist, history
 * and stats all read from localStorage, so they keep working offline once the
 * shell is cached.
 */
export default function OfflinePage() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center pt-10">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-accent-soft">
          <IconCloudOff size={26} />
        </span>
        <h1 className="mt-4 text-xl font-bold text-zinc-100">You are offline</h1>
        <p className="mt-2 text-sm text-zinc-400">
          This page is not saved yet. Your watchlist, history and progress are
          stored on this device and stay available — reconnect to load new
          titles and playback.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="btn-primary">
            <IconRefresh size={15} />
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Go to home
          </Link>
        </div>
      </div>
    </div>
  )
}
