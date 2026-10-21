/**
 * Neutral cover.
 *
 * Site-category filters (school extensions, web monitors, parental controls)
 * decide what a site *is* from cheap, automated signals: the <title>, meta
 * description/keywords, JSON-LD, the URL, and visible text matched against a
 * word list. This module removes those signals so the app reads as, and looks
 * like, a neutral catalogue — every word on screen stays visible to a human,
 * but the content is relabelled and the identity markers are dropped.
 *
 * Scope and honest limits:
 *  - This defeats *automated readability*, not human observation. Anything
 *    painted on screen is observable by a person; no page code can change that.
 *  - It cannot defeat an extension that classifies by the network/DNS the
 *    browser is talking to, or one that does TLS interception. Those operate
 *    below the page and are out of reach from JavaScript.
 *  - Playback URLs are proxy-encoded (see `encodeTarget`) so the upstream host
 *    never appears in a request an extension can observe.
 */

export const COVER_COOKIE = 'cover'

/** Paths used while the cover is active. Kept configurable, not hardcoded. */
export const ITEM_PATH = 'item'
export const VIEWER_PATH = 'view'

/** Neutral self-description shown while covered. */
export const COVER_BRAND = 'Catalog'

export const ITEM_RE = new RegExp(`^/${ITEM_PATH}/`)
export const VIEWER_RE = new RegExp(`^/${VIEWER_PATH}/`)
export const REAL_ITEM_RE = /^\/anime\//
export const REAL_VIEWER_RE = /^\/watch\//

/**
 * Word list that category classifiers key on, mapped to a neutral synonym.
 * Applied to <title>, meta, and every visible text node. Order matters only
 * for the regex, which sorts longest-first so "episodes" wins over "episode".
 */
const TERMS: Record<string, string> = {
  anilist: 'index',
  myanimelist: 'index',
  kitsu: 'index',
  animes: 'items',
  anime: 'item',
  manga: 'title',
  watchlist: 'saved',
  episodes: 'parts',
  episode: 'part',
  streaming: 'playback',
  streams: 'playbacks',
  stream: 'playback',
  subtitles: 'captions',
  subtitle: 'caption',
  subbed: 'original audio',
  dubbed: 'alternate audio',
  trailers: 'previews',
  trailer: 'preview',
  simulcast: 'scheduled',
  airing: 'scheduled',
  seasonal: 'period',
  genres: 'tags',
  genre: 'tag',
  japanese: 'original',
  hls: 'video',
  otaku: 'fan',
  dub: 'alt audio',
  sub: 'orig audio',
  ep: 'pt',
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const TERM_RE = new RegExp(
  `\\b(${Object.keys(TERMS).sort((a, b) => b.length - a.length).map(escapeRe).join('|')})\\b`,
  'gi',
)

/** True when a string still carries a term a classifier would key on. */
export function looksClassifiable(s: string): boolean {
  TERM_RE.lastIndex = 0
  return TERM_RE.test(s)
}

/**
 * Relabel a user-facing string. Preserves capitalisation of the first letter so
 * headings and sentences do not regress to lowercase mid-label.
 */
export function declassifyText(input: string): string {
  if (!input) return input
  return input.replace(TERM_RE, (match) => {
    const replacement = TERMS[match.toLowerCase()] ?? match
    return match[0] === match[0].toUpperCase() && match.slice(1) === match.slice(1).toLowerCase()
      ? replacement[0].toUpperCase() + replacement.slice(1)
      : replacement
  })
}

/**
 * Label a user-facing string, relabelled only while covered. Called during the
 * server render so React sees one consistent string on both sides — relabelling
 * React-owned text in the browser instead fights hydration and can be reverted
 * by any re-render.
 */
/**
 * Neutral page title for a covered detail view.
 *
 * The layout template appends the brand ("%s · Catalog"), so a real title here
 * would leak the content name into the tab and the history entry. "Entry" reads
 * naturally in that template and says nothing about what is being viewed.
 */
export const COVER_ENTRY_TITLE = 'Entry'

export function coverTitle(real: string | null | undefined, covered: boolean): string {
  if (covered) return COVER_ENTRY_TITLE
  return real ?? COVER_ENTRY_TITLE
}

export function coverLabel(label: string, covered: boolean | undefined): string {
  return covered ? declassifyText(label) : label
}

const SLUG_STOP = new Set([
  'a', 'an', 'the', 'of', 'in', 'to', 'and', 'or', 'no', 'wa', 'wo', 'ga', 'ni',
  'de', 'mo', 'na', 'tv', 'movie', 'season', 'part', 'special', 'ova', 'ona',
])

/**
 * Build a bland, non-descriptive label from a title. Used for route slugs so a
 * URL reads `/item/10162/silk-thread` rather than carrying the anime name.
 */
export function coverSlug(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !SLUG_STOP.has(w))
  return words.slice(0, 3).join('-').slice(0, 28) || 'folder'
}

/** A stable opaque folder name for a numeric id, so the slug is not the name. */
export function opaqueName(id: number | string): string {
  return `folder-${String(id).replace(/[^0-9a-z]/gi, '')}`
}

/* ------------------------------------------------- route mapping (pure) --- */

export interface RouteMap {
  itemSlug?: string
  viewerSlug?: string
}

/** `/anime/<id>/...` -> `/item/<slug>/...` (and the reverse). */
export function mapPath(pathname: string, { itemSlug = ITEM_PATH, viewerSlug = VIEWER_PATH }: RouteMap): string {
  if (REAL_ITEM_RE.test(pathname)) {
    const rest = pathname.replace(REAL_ITEM_RE, '')
    return `/${itemSlug}/${stripSlug(rest)}`
  }
  if (REAL_VIEWER_RE.test(pathname)) {
    const rest = pathname.replace(REAL_VIEWER_RE, '')
    return `/${viewerSlug}/${stripSlug(rest)}`
  }
  // Covered -> real, so router prefetches of links we already rewrote resolve.
  if (ITEM_RE.test(pathname) || VIEWER_RE.test(pathname)) {
    const rest = pathname.replace(ITEM_RE, '').replace(VIEWER_RE, '')
    return `${ITEM_RE.test(pathname) ? '/anime/' : '/watch/'}${stripSlug(rest)}`
  }
  return pathname
}

/** Drop the cosmetic slug segment: `10162/silk-thread` -> `10162`. */
function stripSlug(rest: string): string {
  const [id, ...tail] = rest.split('/')
  const numeric = id?.match(/^(\d+)/)?.[1]
  // Second segment is a slug or episode number; keep episodes, drop names.
  const remainder = tail.filter((seg) => seg !== '' && /^\d+$/.test(seg))
  return [numeric ?? id, ...remainder].filter(Boolean).join('/')
}

/* --------------------------------------------- transport obfuscation ----- */

/**
 * Encode a proxy target so the upstream host is not visible in a URL an
 * extension can observe. Base64url, so it is safe inside a query string.
 */
export function encodeTarget(url: string, referer?: string): string {
  const payload = referer ? `${url}\n${referer}` : url
  return Buffer.from(payload, 'utf8').toString('base64url')
}

/** Inverse of `encodeTarget`. */
export function decodeTarget(token: string): { url: string; referer?: string } | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const [url, referer] = raw.split('\n')
    if (!url) return null
    return referer ? { url, referer } : { url }
  } catch {
    return null
  }
}
