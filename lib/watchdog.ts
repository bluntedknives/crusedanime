/**
 * Playback stall recovery.
 *
 * hls.js retries a failed fragment a handful of times and then stops: the
 * `waiting` event has already fired, the element never emits `playing` again,
 * and the UI is left showing a spinner with no end. That is the "spins forever,
 * refresh to fix" symptom — the refresh works only because it rebuilds the
 * hls.js instance.
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
  /** Re-request the current fragment from the existing hls.js instance. */
  | 'reload'
  /**
   * Throw the hls.js instance away and build a new one at the same position.
   * This is the manual refresh, minus the page load, and it is the rung that
   * actually clears a stream hls.js has already given up on: `reload` acts on
   * an instance whose fragment loader has stopped, while a rebuild starts from
   * a clean one.
   */
  | 'rebuild'
  /** Ladder exhausted: hand off to the embed, or report a real error. */
  | 'escalate'

export interface StallState {
  /** Whether playback has ever produced frames. */
  started: boolean
  /** How many recovery actions have already been spent on this stall. */
  attempt: number
  /** Milliseconds since the stall began. */
  elapsedMs: number
}

/**
 * Rung thresholds in milliseconds, indexed by the number of attempts already
 * made.
 *
 * A stall that begins mid-playback gets its first two rungs sooner: the source
 * is known good, so the viewer should not be left waiting on a spinner that has
 * already failed once. A stall that begins before the first frame waits a
 * little longer before the first rung, because a cold start legitimately takes
 * time to fill its buffer.
 *
 * Both ladders end at the same handoff budget, so a stream that is simply dead
 * resolves to the embed at a predictable ~45s rather than spinning.
 */
const LADDER_STARTED: readonly RecoveryAction[] = ['reload', 'rebuild', 'escalate']
const LADDER_COLD: readonly RecoveryAction[] = ['reload', 'rebuild', 'escalate']

const THRESHOLDS_STARTED = [6_000, 15_000, 45_000] as const
const THRESHOLDS_COLD = [8_000, 22_000, 45_000] as const

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
  // `attempt` is the floor: a rung already spent is never chosen again, which is
  // what makes each recovery strictly stronger than the last. A repeat rung is
  // not a harmless retry, it is a rung that cannot make progress.
  for (let i = ladder.length - 1; i >= attempt; i -= 1) {
    if (elapsed < thresholds[i]) continue
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

/**
 * How long playback must run continuously before the ladder is considered
 * finished with. Short resumptions do not count: a stream that plays for two
 * seconds and stalls again has not recovered, and resetting the ladder on every
 * such blip is exactly what left the spinner running forever.
 */
export const HEALTHY_RESET_MS = 10_000

export interface StallClock {
  /**
   * Total time spent not progressing, accumulated across brief resumptions.
   * Drives the ladder, so a stuttering stream still escalates.
   */
  troubleMs: number
  /** Continuous time spent progressing, used to decide when to reset. */
  healthyMs: number
  /** Length of the current uninterrupted freeze. Drives the visible counter. */
  freezeMs: number
}

export function newClock(): StallClock {
  return { troubleMs: 0, healthyMs: 0, freezeMs: 0 }
}

/**
 * Advance the clock by one tick.
 *
 * `progressed` must mean the playhead actually moved, not merely that a media
 * event fired — `canplay` and `timeupdate` both fire repeatedly during a stall
 * loop, so a clock driven by events never accumulates trouble and the ladder
 * never advances.
 */
export function advanceClock(c: StallClock, progressed: boolean, deltaMs: number): StallClock {
  const delta = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0

  if (progressed) {
    const healthyMs = c.healthyMs + delta
    if (healthyMs >= HEALTHY_RESET_MS) {
      // Sustained playback: this stream is fine, so the next stall starts fresh.
      return { troubleMs: 0, healthyMs: 0, freezeMs: 0 }
    }
    // A blip. The freeze is over, but the trouble is not forgotten.
    return { troubleMs: c.troubleMs, healthyMs, freezeMs: 0 }
  }

  return {
    troubleMs: c.troubleMs + delta,
    healthyMs: 0,
    freezeMs: c.freezeMs + delta,
  }
}
