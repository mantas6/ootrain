/**
 * Save integration helpers — cadence + continue/new-run decisions.
 *
 * These sit between the raw {@link localStorageSave} module (pure serialize /
 * load / clear) and the React shell. They are framework-free and testable:
 *
 *   - {@link hasResumableSave} — whether a stored save exists *and* represents a
 *     still-running run (so "Continue" is meaningful; a won/failed save is not
 *     offered and can be cleared).
 *   - {@link AutosaveScheduler} — accumulates elapsed time and reports when the
 *     next periodic autosave is due, plus explicit "save now" triggers (pause,
 *     arriving at a station). Injecting the clock/interval keeps it testable
 *     with fake timers.
 */

import type { SaveStorage } from "./localStorageSave";
import { loadGame } from "./localStorageSave";

/** Default seconds between periodic autosaves. */
export const DEFAULT_AUTOSAVE_INTERVAL_S = 5;

/**
 * Returns true when a stored save exists and is a run still in progress
 * (`runState === "running"`). Won/failed saves are stale and should not offer
 * "Continue".
 */
export function hasResumableSave(storage?: SaveStorage, key?: string): boolean {
  const state = loadGame(storage, key);
  if (state === null) return false;
  return state.runState === "running";
}

/**
 * Tracks periodic autosave timing. Feed it elapsed real time via {@link tick};
 * it returns true once at least `intervalS` has accumulated (and resets the
 * accumulator). {@link markSaved} resets timing after an explicit save so a
 * manual save doesn't immediately trigger a periodic one.
 */
export class AutosaveScheduler {
  private accumulatedS = 0;
  private readonly intervalS: number;

  constructor(intervalS: number = DEFAULT_AUTOSAVE_INTERVAL_S) {
    this.intervalS = intervalS;
  }

  /**
   * Accumulates `dtSeconds`; returns true when a periodic autosave is due,
   * resetting the accumulator. Multiple intervals in one large dt still trigger
   * a single save (we clamp, not queue several).
   */
  tick(dtSeconds: number): boolean {
    if (dtSeconds <= 0) return false;
    this.accumulatedS += dtSeconds;
    if (this.accumulatedS >= this.intervalS) {
      this.accumulatedS = 0;
      return true;
    }
    return false;
  }

  /** Resets the accumulator (call after any explicit save). */
  markSaved(): void {
    this.accumulatedS = 0;
  }
}
