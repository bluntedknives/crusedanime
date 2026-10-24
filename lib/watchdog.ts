/**
 * Playback stall recovery.
 *
 * hls.js retries a failed fragment a handful of times and then simply stops:
 * the `waiting` event has already fired, the element never emits `playing`
 * again, and the UI is left showing a spinner with no end. That is the
 * "spins forever, refresh to fix" symptom — the refresh works only because it
 * rebuilds the hls.js instance.
 *
 * This module decides when to do that rebuild for the viewer, and how
 * aggressively, so the recovery ladder can be unit tested without a browser.
 * The ladder is deliberately escalating and bounded: each rung is a strictly
 * stronger action, and the last rung hands off (to the provider's own player,
 * or to a real error message) rather than looping.
 */

/** Rungs of the ladder, weakest first. */
export type RecoveryAction =
  /** Keep waiting: the stall is still within normal buffering. */
  | 'wait'
  /** Re-request the current fragment/playlist from where we are. */
  | 'reload'
  /** Re-fetch the whole media playlist, which also re-resolves the tunnel. */
  | 'reload-source'
  /** Force a different rendition; a bad variant is a common stall cause. */
  | 'switch-quality'
  /** Ladder exhausted: hand off to the embed, or report a real error. */
  | 'escalate'

export interface StallState {
  /** Whether playback has ever produced frames. */
  started: boolean
  /** How many recovery actions have already been spent on this stall. */
  attempt: number
  /** Milliseconds since the stall began. */
  elapsedMs: number
  /** Whether more than one rendition exists, so a quality switch can help. */
  hasAlternateQuality: boolean
}

/**
 * Rung thresholds in milliseconds, indexed by the number of attempts already
 * made. A stall that begins mid-playback gets the long ladder: the source is
 * known good, so a hiccup is far more likely to be transient than a bad
 * manifest, and a viewer would rather wait than be bounced out of the episode.
 *
 * A stall that begins before the first frame gets a much shorter ladder. There
 * is no playback to protect, and waiting only delays a fallback that is very
 * likely to work — the provider's own page fetches from the viewer's IP.
 */
const LADDER_STARTED: readonly RecoveryAction[] = [
  'reload',
  'reload-source',
  'switch-quality',
  'escalate',
]

const LADDER_COLD: readonly RecoveryAction[] = ['reload', 'reload-source', 'escalate']

const THRESHOLDS_STARTED = [8_000, 20_000, 35_000, 50_000] as const
const THRESHOLDS_COLD = [12_000, 28_000, 45_000] as const

export function recoveryLadder(started: boolean): readonly RecoveryAction[] {
  return started ? LADDER_STARTED : LADDER_COLD
}

export function recoveryThresholds(started: boolean): readonly number[] {
  return started ? THRESHOLDS_STARTED : THRESHOLDS_COLD
}

/**
 * The action to take now, given how long the stall has lasted.
 *
 * Returns `wait` until the current rung's threshold is crossed, so the caller
 * can poll this on a timer and only act when the answer changes.
 */
export function decideRecovery(state: StallState): RecoveryAction {
  const ladder = recoveryLadder(state.started)
  const thresholds = recoveryThresholds(state.started)

  // A non-finite elapsed value means the caller's clock is broken, not that the
  // stall is over. Treat it as "no time has passed" so a glitch cannot jump the
  // viewer straight to the handoff rung.
  const elapsed = Number.isFinite(state.elapsedMs) ? Math.max(0, state.elapsedMs) : 0
  // Clamp rather than trust the caller: an out-of-range attempt would otherwise
  // index past the end of either array.
  const attempt = Number.isFinite(state.attempt)
    ? Math.max(0, Math.min(state.attempt, ladder.length - 1))
    : 0

  // Walk down from the furthest rung reached, so a long stall resolves straight
  // to the strongest action instead of re-running every weaker rung in turn.
  // `attempt` is the floor: a rung already spent is never chosen again, which
  // is what makes each recovery strictly stronger than the last.
  for (let i = ladder.length - 1; i >= attempt; i -= 1) {
    if (elapsed < thresholds[i]) continue
    // A rung that cannot actually run is skipped rather than spent: a quality
    // switch with no second rendition would otherwise burn an attempt doing
    // nothing and leave the viewer no better off.
    if (ladder[i] === 'switch-quality' && !state.hasAlternateQuality) continue
    return ladder[i]
  }
  return 'wait'
}

/**
 * Longest the ladder can run, used to bound the UI copy.
 */
export function recoveryBudgetMs(started: boolean): number {
  const t = recoveryThresholds(started)
  return t[t.length - 1]
}
