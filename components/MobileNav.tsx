'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconBookmark, IconCalendar, IconChart, IconCompass, IconHome, IconPlay,
} from './icons'

const ITEMS = [
  { href: '/', label: 'Home', icon: IconHome, exact: true },
  { href: '/search', label: 'Browse', icon: IconCompass },
  { href: '/schedule', label: 'Schedule', icon: IconCalendar },
  { href: '/upnext', label: 'Up next', icon: IconPlay },
  { href: '/watchlist', label: 'List', icon: IconBookmark },
  { href: '/stats', label: 'Stats', icon: IconChart },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-base-900/95 backdrop-blur-2xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[0.65rem] font-medium transition-colors',
                active ? 'text-accent' : 'text-zinc-500 hover:text-zinc-300',
              ].join(' ')}
            >
              <Icon size={21} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
