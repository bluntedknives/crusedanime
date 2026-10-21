'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[anistream]', error)
  }, [error])

  return (
    <div className="container-page grid min-h-[60vh] place-items-center pt-10">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-zinc-100">Something broke while rendering</h1>
        <p className="mt-2 break-words text-sm text-zinc-400">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Back home
          </Link>
        </div>
      </div>
    </div>
  )
}
