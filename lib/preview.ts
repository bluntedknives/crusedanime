import type { Media } from './anilist'

/**
 * Offline preview data.
 *
 * AniList takes the GraphQL API fully offline for stretches at a time, which
 * otherwise leaves every page blank and makes the app look broken. When the
 * provider is unreachable we render a small set of well-known titles so the
 * interface still demonstrates its layout. Everything here is clearly labelled
 * as preview data in the UI and is never mixed with live results.
 *
 * Posters are generated as inline SVG rather than remote URLs: the real AniList
 * CDN filenames include content hashes we cannot invent, and a generated plate
 * keeps the preview fully offline.
 */

interface Seed {
  id: number
  romaji: string
  english: string
  format: Media['format']
  season: Media['season']
  seasonYear: number
  episodes: number | null
  score: number
  status: Media['status']
  genres: string[]
  description: string
  /** Verified embeddable YouTube trailer id. */
  trailer: string
}

const SEEDS: Seed[] = [
  {
    id: 101922,
    romaji: 'Kimetsu no Yaiba',
    english: 'Demon Slayer: Kimetsu no Yaiba',
    format: 'TV',
    season: 'SPRING',
    seasonYear: 2019,
    episodes: 26,
    score: 83,
    status: 'FINISHED',
    genres: ['Action', 'Adventure', 'Supernatural'],
    description:
      'Tanjiro Kamado sets out to become a demon slayer after his family is slaughtered and his sister is turned into a demon.',
    trailer: 'Sl2k7bfBeCw',
  },
  {
    id: 16498,
    romaji: 'Shingeki no Kyojin',
    english: 'Attack on Titan',
    format: 'TV',
    season: 'SPRING',
    seasonYear: 2013,
    episodes: 25,
    score: 84,
    status: 'FINISHED',
    genres: ['Action', 'Drama', 'Fantasy'],
    description:
      'Humanity fights for survival behind enormous walls against man-eating giants known as Titans.',
    trailer: 'LHtdKWJdif4',
  },
  {
    id: 1535,
    romaji: 'Death Note',
    english: 'Death Note',
    format: 'TV',
    season: 'FALL',
    seasonYear: 2006,
    episodes: 37,
    score: 84,
    status: 'FINISHED',
    genres: ['Mystery', 'Psychological', 'Supernatural'],
    description:
      'A gifted student finds a notebook that kills anyone whose name is written in it, and resolves to reshape the world.',
    trailer: 'NlJZ-YgAt-c',
  },
  {
    id: 21,
    romaji: 'ONE PIECE',
    english: 'One Piece',
    format: 'TV',
    season: 'FALL',
    seasonYear: 1999,
    episodes: null,
    score: 87,
    status: 'RELEASING',
    genres: ['Action', 'Adventure', 'Comedy'],
    description:
      'Monkey D. Luffy sails the Grand Line with his crew in search of the legendary treasure known as One Piece.',
    trailer: 'CmTeYj2FmRc',
  },
  {
    id: 11061,
    romaji: 'Hunter x Hunter (2011)',
    english: 'Hunter x Hunter',
    format: 'TV',
    season: 'FALL',
    seasonYear: 2011,
    episodes: 148,
    score: 89,
    status: 'FINISHED',
    genres: ['Action', 'Adventure', 'Fantasy'],
    description:
      'Gon Freecss becomes a Hunter to track down the father who left him behind, and finds a far stranger world.',
    trailer: 'fda6QzBA2mI',
  },
  {
    id: 5114,
    romaji: 'Fullmetal Alchemist: Brotherhood',
    english: 'Fullmetal Alchemist: Brotherhood',
    format: 'TV',
    season: 'SPRING',
    seasonYear: 2009,
    episodes: 64,
    score: 89,
    status: 'FINISHED',
    genres: ['Action', 'Adventure', 'Drama'],
    description:
      'Two brothers pay a terrible price for forbidden alchemy and search for the Philosophers Stone to undo it.',
    trailer: 'yb2R1l0O9Zs',
  },
  {
    id: 9253,
    romaji: 'Steins;Gate',
    english: 'Steins;Gate',
    format: 'TV',
    season: 'SPRING',
    seasonYear: 2011,
    episodes: 24,
    score: 89,
    status: 'FINISHED',
    genres: ['Drama', 'Sci-Fi', 'Suspense'],
    description:
      'A self-styled mad scientist discovers his microwave can send messages into the past, with consequences he cannot control.',
    trailer: '27OZc-ku6is',
  },
  {
    id: 30276,
    romaji: 'One Punch Man',
    english: 'One-Punch Man',
    format: 'TV',
    season: 'FALL',
    seasonYear: 2015,
    episodes: 12,
    score: 84,
    status: 'FINISHED',
    genres: ['Action', 'Comedy', 'Superhero'],
    description:
      'A hero who can end any fight with a single punch searches for an opponent who might finally challenge him.',
    trailer: 'tMblzsXwAKo',
  },
  {
    id: 20605,
    romaji: 'Tokyo Ghoul',
    english: 'Tokyo Ghoul',
    format: 'TV',
    season: 'SUMMER',
    seasonYear: 2014,
    episodes: 12,
    score: 76,
    status: 'FINISHED',
    genres: ['Action', 'Horror', 'Supernatural'],
    description:
      'A student survives an attack by a ghoul and wakes to find himself caught between two worlds.',
    trailer: 'vGuQeQsoRgU',
  },
  {
    id: 10620,
    romaji: 'Mirai Nikki',
    english: 'Future Diary',
    format: 'TV',
    season: 'FALL',
    seasonYear: 2011,
    episodes: 26,
    score: 75,
    status: 'FINISHED',
    genres: ['Action', 'Suspense', 'Psychological'],
    description:
      'Twelve strangers are handed diaries that predict the future and forced into a battle royale for godhood.',
    trailer: 'KfznTm8mJA4',
  },
  {
    id: 11757,
    romaji: 'Sword Art Online',
    english: 'Sword Art Online',
    format: 'TV',
    season: 'SUMMER',
    seasonYear: 2012,
    episodes: 25,
    score: 74,
    status: 'FINISHED',
    genres: ['Action', 'Adventure', 'Fantasy'],
    description:
      'Players of a virtual reality game find themselves trapped inside it, where death in the game means death in life.',
    trailer: '6ohYYtxfDCg',
  },
  {
    id: 108465,
    romaji: 'Mushoku Tensei: Isekai Ittara Honki Dasu',
    english: 'Mushoku Tensei: Jobless Reincarnation',
    format: 'TV',
    season: 'WINTER',
    seasonYear: 2021,
    episodes: 11,
    score: 84,
    status: 'FINISHED',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    description:
      'A reclusive man is reborn into a world of magic and resolves to live his second life without regret.',
    trailer: 'k5VxfJpzy1Q',
  },
  {
    id: 21519,
    romaji: 'Kimi no Na wa.',
    english: 'Your Name.',
    format: 'MOVIE',
    season: null,
    seasonYear: 2016,
    episodes: 1,
    score: 88,
    status: 'FINISHED',
    genres: ['Drama', 'Romance', 'Supernatural'],
    description:
      'Two teenagers who have never met begin swapping bodies, and race to find each other before it is too late.',
    trailer: '3KR8_igDs1Y',
  },
  {
    id: 21459,
    romaji: 'Boku no Hero Academia',
    english: 'My Hero Academia',
    format: 'TV',
    season: 'SPRING',
    seasonYear: 2016,
    episodes: 13,
    score: 79,
    status: 'FINISHED',
    genres: ['Action', 'Comedy', 'Superhero'],
    description:
      'In a world where most people have powers, a boy born without them is chosen to inherit the greatest quirk of all.',
    trailer: 'D5fYOnwYkj4',
  },
  {
    id: 100166,
    romaji: 'Vinland Saga',
    english: 'Vinland Saga',
    format: 'TV',
    season: 'SUMMER',
    seasonYear: 2019,
    episodes: 24,
    score: 86,
    status: 'FINISHED',
    genres: ['Action', 'Adventure', 'Drama'],
    description:
      'A young Viking warrior joins the band that killed his father, waiting for the chance to take revenge.',
    trailer: '3xAlirMzjCQ',
  },
  {
    id: 127230,
    romaji: 'Chainsaw Man',
    english: 'Chainsaw Man',
    format: 'TV',
    season: 'FALL',
    seasonYear: 2022,
    episodes: 12,
    score: 84,
    status: 'FINISHED',
    genres: ['Action', 'Horror', 'Supernatural'],
    description:
      'A destitute devil hunter merges with his chainsaw devil dog and is drafted into public safety.',
    trailer: 'v4yLeNt-kCU',
  },
  {
    id: 97940,
    romaji: 'Made in Abyss',
    english: 'Made in Abyss',
    format: 'TV',
    season: 'SUMMER',
    seasonYear: 2017,
    episodes: 13,
    score: 85,
    status: 'FINISHED',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    description:
      'A girl and a robot boy descend into a vast pit that curses everyone who climbs back out.',
    trailer: 'MuboGrmPDIg',
  },
  {
    id: 21087,
    romaji: 'Mob Psycho 100',
    english: 'Mob Psycho 100',
    format: 'TV',
    season: 'SUMMER',
    seasonYear: 2016,
    episodes: 12,
    score: 85,
    status: 'FINISHED',
    genres: ['Action', 'Comedy', 'Supernatural'],
    description:
      'An overwhelmingly powerful psychic tries to live an ordinary life and keep his emotions bottled up.',
    trailer: 'F8g3TuKsQHs',
  },
]

/**
 * Deterministic poster plate. Colour is derived from the title so a given show
 * always gets the same artwork, and the initials give it something to anchor
 * the eye while the layout is being reviewed.
 */
function posterPlate(title: string, id: number): string {
  let h = id * 2654435761
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0
  const hue = h % 360
  const hue2 = (hue + 42) % 360
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue},32%,26%)"/>
<stop offset="0.55" stop-color="hsl(${hue2},26%,14%)"/>
<stop offset="1" stop-color="hsl(${hue},30%,8%)"/>
</linearGradient>
<radialGradient id="v" cx="0.5" cy="0.42" r="0.75">
<stop offset="0" stop-color="hsl(${hue},40%,38%)" stop-opacity="0.5"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="300" height="450" fill="url(#g)"/>
<rect width="300" height="450" fill="url(#v)"/>
<text x="150" y="238" font-family="system-ui,sans-serif" font-size="92" font-weight="700"
 fill="#fff" fill-opacity="0.14" text-anchor="middle">${initials}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function previewMedia(): Media[] {
  return SEEDS.map((s) => ({
    id: s.id,
    idMal: null,
    title: { romaji: s.romaji, english: s.english, native: null, userPreferred: s.english },
    description: s.description,
    coverImage: {
      extraLarge: posterPlate(s.english, s.id),
      large: posterPlate(s.english, s.id),
      medium: null,
      color: null,
    },
    bannerImage: null,
    format: s.format,
    status: s.status,
    season: s.season,
    seasonYear: s.seasonYear,
    episodes: s.episodes,
    duration: 24,
    averageScore: s.score,
    meanScore: s.score,
    popularity: 100000,
    favourites: 10000,
    genres: s.genres,
    studios: { edges: [] },
    nextAiringEpisode: null,
    trailer: { id: s.trailer, site: 'youtube', thumbnail: null },
    relations: { edges: [] },
    recommendations: { nodes: [] },
    staff: { edges: [] },
    synonyms: [],
    isAdult: false,
    chapters: null,
    volumes: null,
    countryOfOrigin: 'JP',
    source: 'ORIGINAL',
    hashtag: null,
    startDate: { year: s.seasonYear, month: null, day: null },
    endDate: null,
  }))
}

/** Preview items shaped for the weekly schedule view, spread across the week. */
export function previewSchedule() {
  const items = previewMedia().slice(0, 7)
  const now = Date.now()
  return items.map((media, i) => {
    const airingAt = Math.floor((now + (i + 1) * 6 * 3600 * 1000) / 1000)
    return {
      id: media.id,
      media,
      airingAt,
      timeUntilAiring: airingAt - Math.floor(now / 1000),
      episode: (i % 12) + 1,
    }
  })
}

export function previewById(id: number): Media | null {
  return previewMedia().find((m) => m.id === id) ?? null
}

/** Case-insensitive title match across every title field. */
function matches(m: Media, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  const t = m.title
  return [t.romaji, t.english, t.native, t.userPreferred]
    .filter((v): v is string => Boolean(v))
    .some((v) => v.toLowerCase().includes(needle))
}

/**
 * Filter the preview set with the same semantics as the live search, so the
 * search page behaves identically whether or not the provider is reachable.
 */
export function previewSearch(f: {
  q?: string
  genres?: string[]
  year?: number | null
  season?: string | null
  format?: string | null
  status?: string | null
  scoreMin?: number | null
  sort?: string[]
}) {
  let items = previewMedia()

  items = items.filter((m) => matches(m, f.q ?? ''))
  if (f.genres?.length) {
    items = items.filter((m) => f.genres!.every((g) => m.genres?.includes(g)))
  }
  if (f.year) items = items.filter((m) => m.seasonYear === f.year)
  if (f.season) items = items.filter((m) => m.season === f.season)
  if (f.format) items = items.filter((m) => m.format === f.format)
  if (f.status) items = items.filter((m) => m.status === f.status)
  if (f.scoreMin) items = items.filter((m) => (m.averageScore ?? 0) >= f.scoreMin!)

  const sort = f.sort?.[0] ?? 'POPULARITY_DESC'
  const by: Record<string, (a: Media, b: Media) => number> = {
    SCORE_DESC: (a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0),
    POPULARITY_DESC: (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
    TRENDING_DESC: (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
    START_DATE_DESC: (a, b) => (b.seasonYear ?? 0) - (a.seasonYear ?? 0),
    TITLE_ROMAJI: (a, b) => (a.title.romaji ?? '').localeCompare(b.title.romaji ?? ''),
  }
  items = [...items].sort(by[sort] ?? by.POPULARITY_DESC)

  return {
    pageInfo: {
      total: items.length,
      currentPage: 1,
      lastPage: 1,
      hasNextPage: false,
      perPage: items.length,
    },
    media: items,
  }
}
