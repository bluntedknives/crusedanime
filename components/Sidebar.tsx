'use client'

import { coverLabel } from '@/lib/cover'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  IconBookmark,
  IconCalendar,
  IconCompass,
  IconFlame,
  IconHistory,
  IconHome,
  IconSettings,
  IconShuffle,
} from './icons'
import SettingsDialog from './SettingsDialog'

interface RailItem {
  href: string
  label: string
  icon: (p: { size?: number; className?: string }) => React.ReactElement
  exact?: boolean
}

const ITEMS: RailItem[] = [
  { href: '/', label: 'Home', icon: IconHome, exact: true },
  { href: '/search', label: 'Browse', icon: IconCompass },
  { href: '/trending', label: 'Trending', icon: IconFlame },
  { href: '/schedule', label: 'Schedule', icon: IconCalendar },
  { href: '/watchlist', label: 'Watchlist', icon: IconBookmark },
  { href: '/history', label: 'History', icon: IconHistory },
]

/**
 * Floating icon rail, the Crispy navigation pattern: a single narrow column of
 * icons with a sliding indicator and hover tooltips. Replaces the previous
 * full sidebar, which duplicated links already present in the top bar.
 */
export default function Sidebar({ covered = false }: { covered?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const activeIndex = Math.max(
    0,
    ITEMS.findIndex((i) => (i.exact ? pathname === i.href : pathname.startsWith(i.href))),
  )

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[var(--sidebar-w)] flex-col items-center gap-3 py-5 lg:flex">
        <Link
          href="/"
          aria-label="AniStream home"
          className="grid h-9 w-9 place-items-center rounded-[8px] bg-accent font-display text-base font-black text-black"
        >
          A
        </Link>

        <nav className="rail" aria-label="Primary">
          <span
            aria-hidden
            className="rail-indicator"
            style={{ ['--i' as string]: activeIndex }}
          />
          {ITEMS.map((item) => {
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
