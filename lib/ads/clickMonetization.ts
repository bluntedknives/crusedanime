/**
 * Click-anywhere monetisation.
 *
 * A Smartlink only earns when it is clicked, so leaving it to a card the viewer
 * has to notice leaves most of the traffic unmonetised. This turns any click on
 * the page into that click: the smartlink opens alongside whatever the viewer
 * actually meant to do, so their navigation is never blocked.
 *
 * New tab, not a same-tab redirect. A redirect loses the viewer on their first
 * click and they do not come back, which is worth less than a viewer who keeps
 * browsing and trips the trigger again after the cooldown. Set
 * `NEXT_PUBLIC_ADS_CLICK_MODE=redirect` for the harsher version.
 *
 * The rate limit is what keeps this survivable. One open per CLICK_COOLDOWN_MS,
 * plus a hard per-session cap — without the cap a single determined visitor can
 * farm the link, and that burst pattern is what gets an account flagged.
 *
 * Every check here is synchronous on purpose. Browsers only permit a popup from
 * a real user activation, and that activation is consumed the instant we await
 * anything, so a single `await` anywhere in this path turns the open into a
 * silent no-op.
 */

import { ADS } from './config'
import { adsAllowed } from './consent'
import { adsOptedOut } from './useAdsEnabled'

/** Set to 0 to switch the whole thing off without touching the component tree. */
export const CLICK_AD_ENABLED = process.env.NEXT_PUBLIC_ADS_CLICK_ANYWHERE !== '0'

/** Minimum gap between two click-triggered opens. */
export const CLICK_COOLDOWN_MS = Number(
  process.env.NEXT_PUBLIC_ADS_CLICK_COOLDOWN_MS ?? 60_000,
)

/** Hard ceiling per browsing session, so one visitor cannot farm the link. */
export const CLICK_SESSION_CAP = Number(process.env.NEXT_PUBLIC_ADS_CLICK_CAP ?? 8)

/** Clicks in the first moments after load are usually navigation intent. */
export const CLICK_ARM_DELAY_MS = Number(process.env.NEXT_PUBLIC_ADS_CLICK_ARM_MS ?? 1500)

export type ClickMode = 'tab' | 'redirect'

export const CLICK_MODE: ClickMode =
  process.env.NEXT_PUBLIC_ADS_CLICK_MODE === 'redirect' ? 'redirect' : 'tab'

const LAST_KEY = 'crused:ads:last-click'
const COUNT_KEY = 'crused:ads:click-count'

/**
 * Routes where a click means something other than browsing.
 *
 * The player owns every click on its page: pausing, scrubbing, seeking. Firing
 * an ad on those is not monetisation, it is a bug, and it is the fastest way to
 * get a viewer to close the tab. Every other route is browsable, so a click
 * there really is a click.
 */
const BLOCKED_ROUTES = ['/watch']

/**
 * Elements whose clicks must never trigger an open.
 *
 * The consent banner is the important one: it exists so the viewer can make a
 * choice, and hijacking that click would mean they can never answer it. The ad
 * surfaces are excluded so closing an interstitial does not immediately spawn a
 * second ad, which is how an ad stack becomes unusable.
 */
const NO_TRIGGER_SELECTOR = [
  '[data-no-click-ad]',
  '.ad-consent',
  '.ad-interstitial',
  '.ad-anchor',
  '.smartlink-card',
].join(',')

/**
 * Movement past this, between press and release, means the gesture was a drag.
 *
 * Text selection and scrollbar dragging both end in a `click` event, so without
 * this a viewer highlighting a title would get an ad for their trouble. 8px is
 * above pointer jitter and well below any deliberate drag.
 */
const DRAG_THRESHOLD_PX = 8

let pressX = 0
let pressY = 0

/** Called on pointerdown; see DRAG_THRESHOLD_PX. */
export function notePress(x: number, y: number) {
  pressX = x
  pressY = y
}

function wasDrag(x: number, y: number): boolean {
  return Math.abs(x - pressX) > DRAG_THRESHOLD_PX || Math.abs(y - pressY) > DRAG_THRESHOLD_PX
}

export type ClickAdOutcome =
  | 'fired'
  | 'disabled'
  | 'no-url'
  | 'no-consent'
  | 'opted-out'
  | 'blocked-route'
  | 'blocked-target'
  | 'drag'
  | 'not-armed'
  | 'cooldown'
  | 'session-cap'
  | 'popup-blocked'

let armedAt = 0

/** Called once on mount so the arm delay is measured from real page load. */
export function armClickAd() {
  armedAt = Date.now()
}

function readLast(): number {
  try {
    return Number(localStorage.getItem(LAST_KEY) ?? 0)
  } catch {
    return 0
  }
}

function readCount(): number {
  try {
    return Number(sessionStorage.getItem(COUNT_KEY) ?? 0)
  } catch {
    return 0
  }
}

/**
 * Record a fire.
 *
 * The timestamp goes to localStorage so the cooldown holds across tabs and
 * reloads — a viewer who reloads to dodge the timer must not get a free click.
 * The count goes to sessionStorage because the cap is per session, not forever.
 */
function noteFire() {
  try {
    localStorage.setItem(LAST_KEY, String(Date.now()))
  } catch {
    /* storage disabled */
  }
  try {
    sessionStorage.setItem(COUNT_KEY, String(readCount() + 1))
  } catch {
    /* storage disabled */
  }
}

/** Why the click would be skipped, or null when it should fire. */
export function clickAdBlockedReason(pathname: string): ClickAdOutcome | null {
  if (!CLICK_AD_ENABLED) return 'disabled'
  if (!ADS.smartlink) return 'no-url'
  if (!adsAllowed()) return 'no-consent'
  // Checked separately from consent: consent is the legal gate, while opting out
  // is the viewer's explicit request to see no ads at all. Honouring the first
  // but not the second would be the worse half of the deal.
  if (adsOptedOut()) return 'opted-out'
  if (BLOCKED_ROUTES.some((r) => pathname.startsWith(r))) return 'blocked-route'
  if (armedAt === 0 || Date.now() - armedAt < CLICK_ARM_DELAY_MS) return 'not-armed'
  if (readCount() >= CLICK_SESSION_CAP) return 'session-cap'
  if (Date.now() - readLast() < CLICK_COOLDOWN_MS) return 'cooldown'
  return null
}

/**
 * Fire the click ad, or explain why not.
 *
 * Must be called straight from a click handler with no `await` in between; see
 * the note at the top of this file.
 */
export function fireClickAd(input: {
  pathname: string
  target: EventTarget | null
  button?: number
  modifiers?: boolean
  /** Client coordinates of the click, so a drag can be told from a click. */
  clientX?: number
  clientY?: number
}): ClickAdOutcome {
  // Middle and right clicks are deliberate "open elsewhere" intents, and a
  // modified left click is the viewer explicitly choosing a new tab. Opening on
  // any of those just doubles up on what they asked for.
  if (input.button !== undefined && input.button !== 0) return 'blocked-target'
  if (input.modifiers) return 'blocked-target'

  const el = input.target instanceof Element ? input.target : null
  if (el?.closest(NO_TRIGGER_SELECTOR)) return 'blocked-target'
  if (
    input.clientX !== undefined &&
    input.clientY !== undefined &&
    wasDrag(input.clientX, input.clientY)
  ) {
    return 'drag'
  }

  const blocked = clickAdBlockedReason(input.pathname)
  if (blocked) return blocked

  if (CLICK_MODE === 'redirect') {
    noteFire()
    window.location.href = ADS.smartlink
    return 'fired'
  }

  // `noopener` is deliberately left out of the feature string. Passing it makes
  // window.open return null whether or not the popup was allowed, so there is no
  // way to tell a block from a success — and a blocked open must not burn the
  // cooldown, or the viewer loses the slot entirely. Opening normally gives a
  // real handle, and `opener` is severed immediately after to keep the same
  // protection against reverse tabnabbing.
  const win = window.open(ADS.smartlink, '_blank')
  if (!win) return 'popup-blocked'
  try {
    win.opener = null
  } catch {
    /* cross-origin handle; the tab is still severed by the browser */
  }

  noteFire()
  return 'fired'
}

/** Reset the pacing, for /debug/ads and for testing. */
export function resetClickAdState() {
  try {
    localStorage.removeItem(LAST_KEY)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(COUNT_KEY)
  } catch {
    /* ignore */
  }
}

export function clickAdState() {
  return {
    enabled: CLICK_AD_ENABLED,
    mode: CLICK_MODE,
    cooldownMs: CLICK_COOLDOWN_MS,
    sessionCap: CLICK_SESSION_CAP,
    armDelayMs: CLICK_ARM_DELAY_MS,
    lastFire: readLast(),
    countThisSession: readCount(),
    blockedRoutes: BLOCKED_ROUTES,
  }
}
