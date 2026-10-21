'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SearchBar from './SearchBar'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Browse' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/watchlist', label: 'Watchlist' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header
      className={[
        'sticky top-0 z-50 border-b transition-colors',
        scrolled
          ? 'border-white/5 bg-ink-950/85 backdrop-blur-xl'
          : 'border-transparent bg-gradient-to-b from-ink-950 to-transparent',
      ].join(' ')}
    >
      <div className="container-page flex h-16 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-black text-white">
            A
          </span>
          <span className="hidden text-base font-bold tracking-tight text-zinc-100 sm:block">
            AniStream
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={[
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive(l.href)
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
              ].join(' ')}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden w-full max-w-md md:block">
          <SearchBar
            compact
            onSubmit={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)}
          />
        </div>

        <button
          type="button"
          className="ml-auto rounded-lg p-2 text-zinc-300 hover:bg-white/5 md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-ink-950/95 px-4 pb-4 pt-3 md:hidden">
          <SearchBar
            compact
            onSubmit={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)}
          />
          <nav className="mt-3 grid gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={[
                  'rounded-lg px-3 py-2.5 text-sm font-medium',
                  isActive(l.href) ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/5',
                ].join(' ')}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
