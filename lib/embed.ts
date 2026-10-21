import type { Media } from './anilist'
import { imdbOf } from './movies'

/**
 * Third-party embed fallback.
 *
 * The public-domain catalogue cannot cover a licensed series like South Park —
 * the Internet Archive only holds films that are free to distribute, so those
 * titles browse fine but have nothing to play. These providers fill that gap:
 * they are keyed by IMDb id (which Cinemeta already gives us) and each serves a
 * self-contained player page.
 *
 * They are *embedded*, never scraped. Two reasons, and both matter:
 *
 *  1. Every one of these sits behind Cloudflare's challenge platform
 *     (`/cdn-cgi/challenge-platform/`). A server-side request from a datacenter
 *     IP gets the interstitial, not the video, so there is nothing to extract —
 *     measured, not assumed. Loading the page in the viewer's own browser lets
 *     their real session answer the challenge, which is the only way any of
 *     these resolve.
 *  2. Keeping the player on the provider's origin means the stream, its ads and
 *     its DRM are theirs to manage. We pass an id and render a frame.
 *
 * The host list is ordered by how reliably the player page responded and is
 * tried in turn, so one host going dark degrades instead of breaking.
 */

export type EmbedProvider = {
  id: string
  name: string
  /** Player page for a film. */
  movie: (imdb: string) => string
  /** Player page for one episode. */
  episode: (imdb: string, season: number, episode: number) => string
}

export const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: 'vidsrc',
    name: 'VidSrc',
    movie: (i) => `https://vidsrc.to/embed/movie/${i}`,
    episode: (i, s, e) => `https://vidsrc.to/embed/tv/${i}/${s}/${e}`,
  },
  {
    id: '2embed',
    name: '2Embed',
    movie: (i) => `https://www.2embed.cc/embed/${i}`,
    episode: (i, s, e) => `https://www.2embed.cc/embedtv/${i}&s=${s}&e=${e}`,
  },
  {
    id: 'multiembed',
    name: 'MultiEmbed',
    movie: (i) => `https://multiembed.mov/?video_id=${i}`,
    episode: (i, s, e) => `https://multiembed.mov/?video_id=${i}&s=${s}&e=${e}`,
  },
  {
    id: 'vidlink',
    name: 'VidLink',
    movie: (i) => `https://vidlink.pro/movie/${i}`,
    episode: (i, s, e) => `https://vidlink.pro/tv/${i}/${s}/${e}`,
  },
]

/** Where a title sits in a series. Films are a single "episode". */
export type EmbedSlot = { season: number; episode: number }

/**
 * Build the embed URL for a title, or null when we cannot address it.
 *
 * Without an IMDb id there is nothing to ask for — these providers are
 * IMDb-keyed and do not accept our internal ids. Returning null lets the caller
 * fall back to the honest "unavailable" message rather than rendering a frame
 * that will never load.
 */
export function embedUrl(
  media: Media,
  slot: EmbedSlot,
  providerId = EMBED_PROVIDERS[0].id,
): string | null {
  const imdb = imdbOf(media)
  if (!imdb) return null
  const provider = EMBED_PROVIDERS.find((p) => p.id === providerId) ?? EMBED_PROVIDERS[0]
  // A film is modelled as one episode at S1E1, and the episode form of every
  // provider accepts that, so there is a single URL shape to build.
  return provider.episode(imdb, slot.season, slot.episode)
}
