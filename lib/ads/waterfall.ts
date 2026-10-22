/**
 * The waterfall.
 *
 * This is the fix for "ads barely show". A single network leaves the slot blank
 * whenever it has no demand for this viewer — which is most of the time on a
 * small site. So a slot walks a chain: ask the first adapter, give it a
 * deadline, and if it does not fill inside that deadline, move to the next.
 *
 * The deadline matters as much as the order. An adapter that never calls back
 * would otherwise hang the slot forever, so the race is against a timer rather
 * than trusting the network to be quick or honest. A late fill from an
 * abandoned adapter is harmless: its element has already been cleared.
 */

import { ADAPTERS, type AdAdapter, type AdContext, type AdResult } from './provider'

export const DEFAULT_TIMEOUT_MS = 1500

export interface WaterfallAttempt {
  adapter: string
  filled: boolean
  reason?: string
  ms: number
}

export interface WaterfallResult {
  filled: boolean
  /** Which adapter actually served the slot, or null if all passed. */
  servedBy: string | null
  attempts: WaterfallAttempt[]
}

function withTimeout(p: Promise<AdResult>, ms: number): Promise<AdResult> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ filled: false, reason: 'timeout' }), ms)
    p.then((r) => {
      clearTimeout(t)
      resolve(r)
    }).catch((e: unknown) => {
      clearTimeout(t)
      resolve({ filled: false, reason: e instanceof Error ? e.message : 'error' })
    })
  })
}

/**
 * Walk the chain until something fills.
 *
 * `onAttempt` is called after each adapter so the debug page can show a live
 * trace of what happened, including the ones that passed.
 */
export async function runWaterfall(
  el: HTMLElement,
  ctx: AdContext,
  chain: string[],
  opts: { timeoutMs?: number; onAttempt?: (a: WaterfallAttempt) => void } = {},
): Promise<WaterfallResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const attempts: WaterfallAttempt[] = []

  for (const name of chain) {
    const adapter: AdAdapter | undefined = ADAPTERS[name]
    if (!adapter) {
      const a = { adapter: name, filled: false, reason: 'unknown adapter', ms: 0 }
      attempts.push(a)
      opts.onAttempt?.(a)
      continue
    }
    // An adapter with no id is skipped without touching the DOM at all, so an
    // unconfigured network costs nothing.
    if (!adapter.configured) {
      const a = { adapter: name, filled: false, reason: 'not configured', ms: 0 }
      attempts.push(a)
      opts.onAttempt?.(a)
      continue
    }
    if (!adapter.supportedFormats.includes(ctx.format)) {
      const a = { adapter: name, filled: false, reason: 'unsupported format', ms: 0 }
      attempts.push(a)
      opts.onAttempt?.(a)
      continue
    }

    const started = Date.now()
    const res = await withTimeout(adapter.render(el, ctx), timeoutMs)
    const a: WaterfallAttempt = {
      adapter: name,
      filled: res.filled,
      reason: res.reason,
      ms: Date.now() - started,
    }
    attempts.push(a)
    opts.onAttempt?.(a)

    if (res.filled) return { filled: true, servedBy: name, attempts }
    // Clear whatever the failed adapter left so the next one starts clean.
    el.innerHTML = ''
  }

  return { filled: false, servedBy: null, attempts }
}
