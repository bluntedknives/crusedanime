/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Drops the `X-Powered-By: Next.js` response header. It is a site
  // fingerprint an extension or scanner can classify against.
  poweredByHeader: false,
  // Next 16 blocks cross-origin requests to dev resources (HMR, fonts, chunks)
  // by default. Without this, reaching the dev server through the port-forward
  // serves HTML but the client bundle never loads, so pages stay unhydrated.
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? [
    'work-1-bpweqaeqjdyrqbvs.prod-runtime.all-hands.dev',
    'work-2-bpweqaeqjdyrqbvs.prod-runtime.all-hands.dev',
  ].join(','))
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // The service worker and the app icons must be served from the origin root.
  // `sw.js` in particular must never be cached by the browser for long, or a
  // new build cannot take over; `Service-Worker-Allowed` widens its scope to
  // the whole origin so it can control every route.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, immutable' }],
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 's4.anilist.co' },
      { protocol: 'https', hostname: 'img.anili.st' },
      { protocol: 'https', hostname: '**.anilist.co' },
      { protocol: 'https', hostname: '**.kitsu.app' },
      { protocol: 'https', hostname: 'media.kitsu.io' },
      { protocol: 'https', hostname: '**.zanix.tr' },
      { protocol: 'https', hostname: '**.4animo.xyz' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      // Cinemeta serves film/TV posters and backdrops from these two hosts.
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: '**.nozomi.la' },
    ],
  },
}
export default nextConfig
