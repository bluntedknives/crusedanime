'use client'

import { useEffect, useState } from 'react'
import { IconCloudOff, IconRefresh } from './icons'

/**
 * Registers the service worker and surfaces its two states a user cares about:
 * a new version is ready, or the browser has gone offline.
 *
 * Registration is production-only. In dev the worker would cache the dev
 * server's HTML and hashed chunks and fight hot reload, so it is skipped there
 * — offline is a production concern anyway.
 */
export default function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    let reg: ServiceWorkerRegistration | undefined
    let cancelled = false

    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting)
      r.addEventListener('updatefound', () => {
        const next = r.installing
        next?.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(next)
          }
        })
      })
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((r) => {
        if (cancelled) return
        reg = r
        watch(r)
      })
      .catch(() => {})

    // Reload once the new worker has taken control, so the page runs the code
    // that matches the active worker.
    let reloading = false
    const onController = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onController)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
    }
  }, [])

  const reload = () => {
    waiting?.postMessage('SKIP_WAITING')
    setWaiting(null)
  }

  if (!waiting && !offline) return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[65] flex justify-center px-4 lg:bottom-5">
      {offline && !waiting ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-full border border-white/10 bg-base-850/95 px-3.5 py-1.5 text-xs font-medium text-zinc-300 shadow-2xl backdrop-blur-xl"
        >
          <IconCloudOff size={14} className="text-accent-soft" />
          Offline — showing saved content
        </div>
      ) : (
        <div
          role="status"
          className="flex items-center gap-3 rounded-full border border-white/10 bg-base-850/95 py-1.5 pl-4 pr-1.5 text-xs font-medium text-zinc-200 shadow-2xl backdrop-blur-xl"
        >
          A new version is ready
          <button
            type="button"
            onClick={reload}
            className="btn-primary h-7 gap-1.5 px-3 text-[0.7rem]"
          >
            <IconRefresh size={13} />
            Reload
          </button>
        </div>
      )}
    </div>
  )
}
