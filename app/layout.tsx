import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: {
    default: 'AniStream — anime, tracked',
    template: '%s · AniStream',
  },
  description:
    'Browse, search and stream anime with AniList metadata. Trending, seasonal, schedules and your own watchlist — all in one dark-first interface.',
  applicationName: 'AniStream',
  keywords: ['anime', 'anilist', 'streaming', 'watchlist', 'hls'],
}

export const viewport: Viewport = {
  themeColor: '#07070b',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans antialiased">
        <Navbar />
        <main className="pb-24 pt-4">{children}</main>
        <footer className="border-t border-white/5 py-10 text-center text-xs text-zinc-500">
          <p>
            Metadata from AniList. Streams are resolved from third-party providers and proxied for
            playback. AniStream hosts no content.
          </p>
        </footer>
      </body>
    </html>
  )
}
