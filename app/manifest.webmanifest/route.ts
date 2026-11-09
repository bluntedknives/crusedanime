import { NextResponse } from 'next/server'
import { isCovered } from '@/lib/coverServer'
import { COVER_BRAND } from '@/lib/cover'

/**
 * Web app manifest, served dynamically so it can honour restricted mode.
 *
 * Makes the app installable and, once installed, launchable in its own
 * standalone window on both iOS (Add to Home Screen) and Android/desktop
 * (install prompt). `orientation: any` on purpose — this is a video app, so a
 * locked portrait would break fullscreen playback in landscape.
 *
 * While the cover cookie is set the name is neutralised, exactly as the
 * document title is, so an installed shortcut does not reintroduce the
 * identity the rest of the cover removes. A manifest is plain text a
 * classifier reads trivially, so it must not be the one place the real name
 * survives.
 */
export const dynamic = 'force-dynamic'

const ICONS = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  {
    src: '/icons/icon-maskable-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  },
]

export async function GET() {
  const covered = await isCovered()

  const body = {
    name: covered ? COVER_BRAND : 'crused.wtf',
    short_name: covered ? COVER_BRAND : 'crused',
    description: covered
      ? 'A personal collection index.'
      : 'Browse, search and stream with AniList metadata. Trending, seasonal, schedules and your own watchlist in one dark-first interface.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#000000',
    theme_color: '#08090b',
    categories: ['entertainment', 'video'],
    icons: ICONS,
  }

  return NextResponse.json(body, {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'no-cache',
    },
  })
}
