/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 's4.anilist.co' },
      { protocol: 'https', hostname: 'img.anili.st' },
      { protocol: 'https', hostname: '**.anilist.co' },
      { protocol: 'https', hostname: '**.zanix.tr' },
      { protocol: 'https', hostname: '**.4animo.xyz' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '**.nozomi.la' },
    ],
  },
}
export default nextConfig
