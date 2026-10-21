/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
