/**
 * Impression and viewability accounting.
 *
 * Two different numbers, and conflating them is how a site ends up with
 * traffic it cannot sell:
 *
 *   impression  the creative was inserted into the DOM and rendered.
 *   viewable    at least half the creative was on screen, continuously, for a
 *               full second. That is the IAB threshold and it is the number
 *               buyers actually pay against.
 *
 * Counters live in module state for the current session and are mirrored to
 * localStorage so /debug/ads can show a running total. Nothing leaves the
 * browser; this is instrumentation for us, not reporting to a network.
 */

export interface SlotStats {
  /** Times a slot reached the point of requesting an ad. */
  requests: number
  /** Times a creative was inserted. */
  impressions: number
  /** Times the creative met the viewability threshold. */
  viewables: number
  /** Which adapter served most recently. */
  servedBy: string | null
  /** The full attempt trace from the last request. */
  lastAttempts: { adapter: string; filled: boolean; reason?: string; ms: number }[]
}

export interface AdEvent {
  slot: string
  kind: 'request' | 'impression' | 'viewable' | 'skip'
  adapter?: string | null
  reason?: string
  at: number
}

const STORAGE_KEY = 'crused:ads:stats'

type Store = Record<string, SlotStats>

const empty = (): SlotStats => ({
  requests: 0,
  impressions: 0,
  viewables: 0,
  servedBy: null,
  lastAttempts: [],
})

let store: Store = {}
let events: AdEvent[] = []
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* storage disabled — in-memory is enough */
  }
}

export function loadStats(): Store {
  if (Object.keys(store).length) return store
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) store = JSON.parse(raw) as Store
  } catch {
    /* ignore */
  }
  return store
}

export function resetStats() {
  store = {}
  events = []
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

function bump(slot: string, fn: (s: SlotStats) => void) {
  const cur = store[slot] ?? empty()
  fn(cur)
  store = { ...store, [slot]: cur }
  persist()
  listeners.forEach((l) => l())
}

export function recordRequest(slot: string) {
  bump(slot, (s) => {
    s.requests += 1
  })
  push({ slot, kind: 'request', at: Date.now() })
}

export function recordAttempts(
  slot: string,
  attempts: SlotStats['lastAttempts'],
  servedBy: string | null,
) {
  bump(slot, (s) => {
    s.lastAttempts = attempts
    s.servedBy = servedBy
  })
}

export function recordImpression(slot: string, adapter: string | null) {
  bump(slot, (s) => {
    s.impressions += 1
    s.servedBy = adapter
  })
  push({ slot, kind: 'impression', adapter, at: Date.now() })
}

export function recordViewable(slot: string) {
  bump(slot, (s) => {
    s.viewables += 1
  })
  push({ slot, kind: 'viewable', at: Date.now() })
}

export function recordSkip(slot: string, reason: string) {
  push({ slot, kind: 'skip', reason, at: Date.now() })
}

function push(e: AdEvent) {
  events = [...events.slice(-199), e]
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __ADS_EVENTS?: AdEvent[] }).__ADS_EVENTS = events
  }
}

export function getEvents(): AdEvent[] {
  return events
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Snapshot for the debug page, including derived viewability rate. */
export function snapshot() {
  loadStats()
  return Object.entries(store).map(([slot, s]) => ({
    slot,
    ...s,
    viewabilityRate: s.impressions ? s.viewables / s.impressions : 0,
  }))
}
