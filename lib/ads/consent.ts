/**
 * Consent state, and the gate that keeps ad scripts from loading before it.
 *
 * Ad networks set cookies. In the EU/UK that requires prior consent, and in
 * California it requires an opt-out. The simple, defensible behaviour is: do
 * not contact a single network until the viewer says yes, and treat "no answer"
 * as "no". The banner is shown, and until it is answered every slot renders the
 * house box instead.
 *
 * Consent is stored per browser and can be revoked from settings at any time,
 * which is what actually makes it consent rather than a one-off notice.
 */

export type ConsentValue = 'granted' | 'denied' | null

const KEY = 'crused:ads:consent'

/** Set to 0 to run without the banner (e.g. a jurisdiction that does not require it). */
export const CONSENT_REQUIRED = process.env.NEXT_PUBLIC_ADS_CONSENT_REQUIRED !== '0'

let value: ConsentValue = null
let hydrated = false
const listeners = new Set<() => void>()

export function getConsent(): ConsentValue {
  return value
}

export function isHydrated(): boolean {
  return hydrated
}

export function hydrateConsent() {
  if (hydrated) return
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === 'granted' || raw === 'denied') value = raw
  } catch {
    /* ignore */
  }
  hydrated = true
  listeners.forEach((l) => l())
}

export function setConsent(v: Exclude<ConsentValue, null>) {
  value = v
  hydrated = true
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function clearConsent() {
  value = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function subscribeConsent(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Whether ads may load right now.
 *
 * Returns false while consent is still unanswered, so nothing is contacted
 * before a decision. When consent is not required, ads load immediately.
 */
export function adsAllowed(): boolean {
  if (!CONSENT_REQUIRED) return true
  return value === 'granted'
}

/** True only when we should be asking. */
export function shouldAskConsent(): boolean {
  return CONSENT_REQUIRED && hydrated && value === null
}
