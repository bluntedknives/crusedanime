import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center pt-10">
      <div className="text-center">
        <p className="text-6xl font-black text-accent">404</p>
        <h1 className="mt-3 text-xl font-bold text-zinc-100">We could not find that title</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
          The anime id or episode may be wrong, or AniList no longer has that entry.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary">
            Back home
          </Link>
          <Link href="/search" className="btn-ghost">
            Search anime
          </Link>
        </div>
      </div>
    </div>
  )
}
