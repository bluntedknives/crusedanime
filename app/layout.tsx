import type { Metadata, Viewport } from 'next'
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import CoverClient from '@/components/CoverClient'
import AnchorAd from '@/components/ads/AnchorAd'
import ConsentBanner from '@/components/ads/ConsentBanner'
import InterstitialAd from '@/components/ads/InterstitialAd'
import PopunderAd from '@/components/ads/PopunderAd'
import ClickMonetization from '@/components/ads/ClickMonetization'
import AdBlockPrompt from '@/components/ads/AdBlockPrompt'
import CommandPalette from '@/components/CommandPalette'
import ShortcutsHelp from '@/components/ShortcutsHelp'
import GlobalShortcuts from '@/components/GlobalShortcuts'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import InstallDialog from '@/components/InstallDialog'
import InstallPrompt from '@/components/InstallPrompt'
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
      title: { default: 'crused.wtf', template: '%s · crused.wtf' },
      description:
        'Browse, search and stream with AniList metadata. Trending, seasonal, schedules and your own watchlist in one dark-first interface.',
      applicationName: 'crused.wtf',
      // YouTube refuses to embed when the Referer is absent (it surfaces as
      // "Video player configuration error", Error 153), so the strictest
      // policy cannot be used site-wide. `strict-origin-when-cross-origin`
      // still sends nothing to plain-HTTP destinations and only the bare
      // origin to other HTTPS hosts — never the full path.
      referrer: 'strict-origin-when-cross-origin',
      manifest: '/manifest.webmanifest',
      // iOS "Add to Home Screen": launch full-screen with the status bar drawn
      // over the app (black-translucent), which suits the black canvas. The
      // apple-touch-icon comes from the app/apple-icon.png file convention.
      appleWebApp: {
        capable: true,
        title: 'crused',
        statusBarStyle: 'black-translucent',
      },
      // Stop iOS from turning episode counts and years into phone-number or
      // date links inside synopses and episode titles.
      formatDetection: { telephone: false, date: false, email: false, address: false },
      // Older iOS reads this legacy flag (before it honoured the manifest's
      // `display: standalone`); modern iOS uses the manifest. Both are set.
      other: { 'apple-mobile-web-app-capable': 'yes' },
    }
  }
  return {
    ...coverMetadata(
      {
        title: { default: COVER_BRAND, template: `%s · ${COVER_BRAND}` },
        description: 'A personal collection index.',
        applicationName: COVER_BRAND,
        manifest: '/manifest.webmanifest',
        appleWebApp: {
          capable: true,
          title: COVER_BRAND,
          statusBarStyle: 'black-translucent',
        },
        formatDetection: { telephone: false, date: false, email: false, address: false },
      },
      true,
    ),
    // Re-added after the cover strips `other`: the flag carries no identity.
    other: { 'apple-mobile-web-app-capable': 'yes' },
  }
}

export const viewport: Viewport = {
  themeColor: '#08090b',
  colorScheme: 'dark',
  // The player and fixed bottom nav both rely on the real viewport edges, so
  // let content extend under the notch and home indicator and inset it
  // deliberately with env(safe-area-inset-*).
  viewportFit: 'cover',
  // The on-screen keyboard should resize the layout viewport rather than only
  // the visual one, so the fixed bottom nav never floats over the keyboard.
  interactiveWidget: 'resizes-content',
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
      {/* Off by default: Adsterra's injected formats only load if a script src
          is configured. Never mounted on the watch route. */}
      {/* Page-level ad formats. Each one mounts after first paint so nothing
          here competes with LCP, and each is dismissible. The anchor and
          interstitial both stand down on /watch, where the player owns the
          screen. */}
      <ConsentBanner />
      <AnchorAd />
      <InterstitialAd />
      <PopunderAd />
      {/* Turns any click into a rate-limited Smartlink open. Renders nothing;
          see lib/ads/clickMonetization.ts for the pacing rules. */}
      <ClickMonetization />
      <AdBlockPrompt />
      {/* Global keyboard surfaces. Both render nothing until invoked, and the
          palette doubles as the top bar's search affordance on desktop. */}
      <CommandPalette />
      <ShortcutsHelp />
      <GlobalShortcuts />
      {/* PWA surfaces: registers the service worker and, on mobile, offers to
          install the app. The prompt is dismissible and never shows on /watch. */}
      <ServiceWorkerRegister />
      <InstallDialog />
      <InstallPrompt />
        <Sidebar covered={covered} />
        <div className="lg:pl-[var(--sidebar-w)]">
          <TopBar covered={covered} />
          <main className="min-h-[60vh] pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 lg:pb-16">{children}</main>
          <footer className="border-t border-white/[0.06] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 text-center lg:pb-8">
            <p className="mx-auto max-w-2xl font-mono text-[0.65rem] leading-relaxed tracking-wide text-zinc-600">
              {covered
                ? `A personal catalogue index. Entries are referenced from third-party providers and played back locally. ${COVER_BRAND} hosts no content.`
                : `Metadata from AniList. Streams are resolved from third-party providers and proxied for playback. crused.wtf hosts no content.`}
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
