import type { Metadata, Viewport } from 'next'
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import CoverClient from '@/components/CoverClient'
import { coverMetadata, isCovered } from '@/lib/coverServer'
import { COVER_BRAND } from '@/lib/cover'

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

// Tighter and more editorial than Inter — reserved for titles and headings.
const display = Inter_Tight({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

/**
 * Metadata is branch-dependent.
 *
 * Normally the app keeps its real name: the cover is a deliberate opt-in state,
 * and renaming the app in its default mode would be its own kind of broken.
 * With restricted mode on, the neutral identity is emitted by the *server* so a
 * classifier reading the document at `document_start` already sees it.
 *
 * `keywords` is gone in both modes: it is the single highest-signal field a
 * category classifier reads and it is invisible to users, so it buys nothing.
 */
export async function generateMetadata(): Promise<Metadata> {
  if (!(await isCovered())) {
    return {
      title: { default: 'AniStream — anime, tracked', template: '%s · AniStream' },
      description:
        'Browse, search and stream anime with AniList metadata. Trending, seasonal, schedules and your own watchlist — all in one dark-first interface.',
      applicationName: 'AniStream',
      referrer: 'no-referrer',
    }
  }
  return coverMetadata(
    {
      title: { default: COVER_BRAND, template: `%s · ${COVER_BRAND}` },
      description: 'A personal collection index.',
      applicationName: COVER_BRAND,
    },
    true,
  )
}

export const viewport: Viewport = {
  themeColor: '#08090b',
  colorScheme: 'dark',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const covered = await isCovered()
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <CoverClient />
        <Sidebar covered={covered} />
        <div className="lg:pl-[var(--sidebar-w)]">
          <TopBar covered={covered} />
          <main className="min-h-[60vh] pb-28 pt-5 lg:pb-16">{children}</main>
          <footer className="border-t border-white/[0.06] px-4 py-8 text-center lg:pb-8">
            <p className="mx-auto max-w-2xl font-mono text-[0.65rem] leading-relaxed tracking-wide text-zinc-600">
              {covered
                ? `A personal catalogue index. Entries are referenced from third-party providers and played back locally. ${COVER_BRAND} hosts no content.`
                : `Metadata from AniList. Streams are resolved from third-party providers and proxied for playback. AniStream hosts no content.`}
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
