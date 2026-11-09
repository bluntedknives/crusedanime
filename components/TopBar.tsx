'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { IconBookmark, IconClose, IconFlame, IconHistory, IconMenu } from './icons'
import SearchBar from './SearchBar'
import { coverLabel } from '@/lib/cover'
import MobileNav from './MobileNav'

const LINKS = [
  { href: '/trending', label: 'Trending', icon: IconFlame },
  { href: '/watchlist', label: 'Watchlist', icon: IconBookmark },
  { href: '/history', label: 'History', icon: IconHistory },
]

export default function TopBar({ covered = false }: { covered?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  // The "/" hotkey lives in SearchBar, which owns the field.

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-base/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container-page flex h-16 items-center gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-8 lg:pr-8">
          <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden" aria-label="crused.wtf home">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-accent font-display text-base font-black text-base-900">
              c
            </span>
          </Link>

          {/* One search surface app-wide: the same component the search page
              uses, so suggestions and recent searches behave identically. */}
          <div className="flex-1 sm:max-w-md">
            <SearchBar
              compact
              hotkey
              onQueryChange={() => {}}
              onSubmit={(q) =>
                router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
              }
            />
          </div>

          <nav className="ml-auto hidden items-center gap-0.5 md:flex">
            {LINKS.map((l) => {
              const Icon = l.icon
              const active = pathname.startsWith(l.href)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={[
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-white/[0.06] font-semibold text-white'
                      : 'font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100',
                  ].join(' ')}
                >
                  <Icon size={16} className={active ? 'text-accent' : 'text-zinc-500'} />
                  {coverLabel(l.label, covered)}
                </Link>
              )
            })}
          </nav>

          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            className="btn-icon ml-auto h-10 w-10 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={navOpen}
          >
            {navOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
          </button>
        </div>

        {navOpen && (
          <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 md:hidden">
            <nav className="grid gap-0.5">
              {[
                { href: '/', label: 'Home' },
                { href: '/search', label: 'Browse' },
                { href: '/trending', label: 'Trending' },
                { href: '/schedule', label: 'Schedule' },
                { href: '/upnext', label: 'Up next' },
                { href: '/season', label: 'Seasons' },
                { href: '/genres', label: 'Genres' },
                { href: '/random', label: 'Random' },
                { href: '/watchlist', label: 'Watchlist' },
                { href: '/ratings', label: 'Ratings' },
                { href: '/history', label: 'History' },
                { href: '/stats', label: 'Stats' },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {coverLabel(l.label, covered)}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <MobileNav />
    </>
  )
}
