/**
 * Slot declarations.
 *
 * Each slot names its format, the space it reserves, and the order of adapters
 * to try. The chain ends in `house`, which always fills, so no slot is ever
 * blank and the layout never collapses.
 *
 * Reserved size is not advisory. The container is sized before any network is
 * contacted, so a slow or absent ad cannot shift the page — the slot occupies
 * its box whether or not a creative lands in it.
 */

import type { AdFormat, AdSize } from '@/lib/ads/provider'

export interface SlotConfig {
  /** Must match the `slot` prop passed to <AdSlot>. */
  name: string
  format: AdFormat
  size: AdSize
  /** Adapter order. The last entry should always be `house`. */
  chain: string[]
  /** Human note for /debug/ads. */
  note: string
}

export const SLOTS: Record<string, SlotConfig> = {
  anchor: {
    name: 'anchor',
    format: 'anchor',
    size: { width: 728, height: 90 },
    chain: ['smartlink', 'adsense', 'adsterra', 'monetag', 'propeller', 'house'],
    note: 'Dismissible sticky bottom bar. Highest-RPM format; loads after first paint.',
  },
  'in-feed': {
    name: 'in-feed',
    format: 'native',
    size: { width: 300, height: 250 },
    chain: ['smartlink', 'adsense', 'ezoic', 'adsterra', 'monetag', 'house'],
    note: 'Injected every 6 cards in the home and browse grids.',
  },
  'below-player': {
    name: 'below-player',
    format: 'banner',
    size: { width: 728, height: 90 },
    chain: ['smartlink', 'adsense', 'adsterra', 'monetag', 'house'],
    note: 'Directly under the player on /watch. Never inside or over the player.',
  },
  'sidebar-sticky': {
    name: 'sidebar-sticky',
    format: 'banner',
    size: { width: 300, height: 600 },
    chain: ['smartlink', 'adsense', 'adsterra', 'house'],
    note: 'Desktop only, on /watch and /anime/[id]. Hidden below 1280px.',
  },
  interstitial: {
    name: 'interstitial',
    format: 'interstitial',
    size: { width: 640, height: 480 },
    chain: ['smartlink', 'adsterra', 'monetag', 'house'],
    note: 'On route change, capped to one per 60 seconds.',
  },
  popunder: {
    name: 'popunder',
    format: 'popunder',
    size: { width: 1, height: 1 },
    chain: ['smartlink', 'adsterra', 'monetag', 'propeller'],
    note: 'One per session, on the first user gesture. No house fallback — a 1x1 house box is pointless.',
  },
}

export const SLOT_NAMES = Object.keys(SLOTS)

/** How often an in-feed ad is inserted into a card grid. */
export const IN_FEED_EVERY = 6

/** Interstitial pacing, in milliseconds. */
export const INTERSTITIAL_COOLDOWN_MS = 60_000

/**
 * The chain that runs when no network id is configured at all.
 *
 * On localhost this is what every slot resolves to, so the house box is what
 * you see. That is intentional: it proves the slot rendered and reserved its
 * space, which is exactly what a real fill would do.
 */
export const HOUSE_ONLY = ['house']
