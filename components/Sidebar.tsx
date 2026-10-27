'use client'

import { coverLabel } from '@/lib/cover'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  IconBookmark,
  IconCalendar,
  IconChart,
  IconCompass,
  IconDots,
  IconFlame,
  IconGrid2,
  IconHistory,
  IconHome,
  IconPlay,
  IconSettings,
  IconShuffle,
  IconSparkle,
  IconStar,
} from './icons'
import SettingsDialog from './SettingsDialog'

interface RailItem {
  href: string
  label: string
  icon: (p: { size?: number; className?: string }) => React.ReactElement
  exact?: boolean
}

/**
 * The four places a visitor actually goes, plus browse.
 *
 * The rail used to carry all eleven destinations, which made a 34px-wide
 * column the densest part of the screen and gave every route equal weight.
 * Anything that is a look-up rather than a destination now lives behind More.
 */
const PRIMARY: RailItem[] = [
  { href: '/', label: 'Home', icon: IconHome, exact: true },
  { href: '/search', label: 'Browse', icon: IconCompass },
  { href: '/watchlist', label: 'Watchlist', icon: IconBookmark },
  { href: '/upnext', label: 'Up next', icon: IconPlay },
  { href: '/schedule', label: 'Schedule', icon: IconCalendar },
]

const MORE: RailItem[] = [
  { href: '/trending', label: 'Trending', icon: IconFlame },
  { href: '/season', label: 'Seasons', icon: IconGrid2 },
  { href: '/genres', label: 'Genres', icon: IconSparkle },
  { href: '/ratings', label: 'Ratings', icon: IconStar },
  { href: '/history', label: 'History', icon: IconHistory },
  { href: '/stats', label: 'Stats', icon: IconChart },
]

export default function Sidebar({ covered = false }: { covered?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const activeIndex = Math.max(
    0,
    PRIMARY.findIndex((i) => (i.exact ? pathname === i.href : pathname.startsWith(i.href))),
  )
  const moreActive = MORE.some((i) => pathname.startsWith(i.href))

  // Close the popover on navigation, outside click and Escape.
  useEffect(() => setMoreOpen(false), [pathname])
  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[var(--sidebar-w)] flex-col items-center gap-3 py-5 lg:flex">
        <Link
          href="/"
          aria-label="crused.wtf home"
          className="grid h-9 w-9 place-items-center rounded-[8px] bg-accent font-display text-base font-black text-black"
        >
          c
        </Link>

        <nav className="rail" aria-label="Primary">
          <span aria-hidden className="rail-indicator" style={{ ['--i' as string]: activeIndex }} />
          {PRIMARY.map((item) => {
            const Icon = item.icon
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="rail-btn"
              >
                <Icon size={18} />
                <span className="rail-tip">{coverLabel(item.label, covered)}</span>
              </Link>
            )
          })}
        </nav>

        <div className="rail mt-auto">
          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="More destinations"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-current={moreActive ? 'page' : undefined}
              className="rail-btn"
            >
              <IconDots size={18} />
              <span className="rail-tip">{coverLabel('More', covered)}</span>
            </button>

            {moreOpen && (
              <div
                role="menu"
                aria-label="More destinations"
                className="absolute bottom-0 left-[calc(100%+0.6rem)] z-50 w-44 overflow-hidden rounded-xl border border-white/[0.09] bg-base-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-scale-in"
              >
                {MORE.map((item) => {
                  const Icon = item.icon
                  const active = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        active
                          ? 'bg-white/[0.07] font-semibold text-white'
                          : 'font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100',
                      ].join(' ')}
                    >
                      <Icon size={15} className={active ? 'text-accent' : 'text-zinc-500'} />
                      {coverLabel(item.label, covered)}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push('/random')}
            className="rail-btn"
            aria-label="Surprise me"
          >
            <IconShuffle size={18} />
            <span className="rail-tip">Surprise me</span>
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rail-btn"
            aria-label="Settings"
          >
            <IconSettings size={18} />
            <span className="rail-tip">Settings</span>
          </button>
        </div>
      </aside>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
