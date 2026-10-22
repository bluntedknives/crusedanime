# crused.wtf

An anime streaming front end. AniList provides the catalogue metadata, Consumet
resolves episode sources, and playback runs in the browser through hls.js.

## Stack

- Next.js 16 (App Router) with React 19 and TypeScript
- Tailwind for styling, dark-first
- AniList GraphQL for metadata
- Consumet for episode sources and subtitles
- hls.js for HLS playback
- localStorage for the watchlist and episode progress

## Running it

```bash
npm install
npm run dev
```

The dev server listens on port 12000 (`npm run dev`, `npm start`). Set
`ALLOWED_DEV_ORIGINS` if you reach it through a forwarded hostname, otherwise
Next blocks the client bundle and pages render without hydrating.

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

## Configuration

Everything account-specific lives in `.env.local`, which is gitignored:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_ADS_SMARTLINK_URL` | Adsterra Smartlink URL |
| `NEXT_PUBLIC_ADS_CLICK_ANYWHERE` | `1` to enable click monetisation |
| `NEXT_PUBLIC_ADS_CLICK_MODE` | `new-tab` (default) or `redirect` |
| `NEXT_PUBLIC_ADS_CLICK_COOLDOWN_MS` | Minimum gap between ad opens |
| `NEXT_PUBLIC_ADS_CLICK_CAP` | Maximum opens per session |

No ad network is required to run the app. With no Smartlink URL set, every ad
surface falls back to a house placeholder and playback is unaffected.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Home: trending and popular grids |
| `/search` | Search with genre, year, season, format, status and score filters |
| `/anime/[id]` | Detail: synopsis, studios, relations, recommendations, episodes |
| `/watch/[id]/[ep]` | HLS player with sub/dub toggle and progress saving |
| `/schedule` | This week's airing, grouped by day |
| `/trending` | Trending catalogue |
| `/watchlist`, `/history` | Saved titles and playback progress |
| `/random` | Redirects to a random title |
| `/debug/ads` | Live ad state, pacing counters and a reset button |

Cover mode rewrites content-bearing paths under neutral prefixes
(`/item/*`, `/view/*`) so history, bookmarks and referrers never carry a
title-bearing path. See `middleware.ts` and `lib/cover.ts`.

## Layout

```
app/           routes and route handlers
  api/         anilist, episodes, stream, search, proxy (HLS)
components/    UI, plus ads/ for the ad surfaces
config/ads.ts  slot definitions and waterfall chains
lib/           anilist client, consumet client, cover, store
lib/ads/       consent, provider adapters, waterfall, telemetry
```

## Notes

AniList takes the API fully offline for stretches at a time, and public Consumet
mirrors come and go. Both are external and outside our control, so the app
degrades rather than failing: metadata falls back to Kitsu and then to a clearly
labelled offline preview set, and playback surfaces a warm-stream state instead
of a dead player.
