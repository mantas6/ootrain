/**
 * Toast event detection — a **pure** snapshot-transition helper.
 *
 * Following the same pattern as {@link detectAudioEvents} in the audio layer,
 * {@link detectToastEvents} diffs two consecutive {@link GameSnapshot}s and
 * returns the positive-feedback events that should surface as brief on-screen
 * toasts:
 *
 *   - `money`   — money increased while stopped in a station's range (a cargo
 *                 delivery / reward payout).
 *   - `rescue`  — the emergency-fuel rescue counter increased (a rescue crew
 *                 topped up the tank in relaxed mode).
 *   - `upgrade` — a new upgrade id appeared in the owned list (a purchase).
 *
 * Keeping this pure (no React, no timers, no DOM) means it is trivially unit
 * tested, and the sim/UI stay untouched — the toast component just renders what
 * this returns.
 */

import type { GameSnapshot } from "../../game/simulation/types";

/** Money must rise by at least this much (in range) to count as earnings. */
const MONEY_EPSILON = 1;

/** A positive-feedback event derived from a snapshot transition. */
export type ToastEvent =
  | { kind: "money"; amountEarned: number }
  | { kind: "rescue" }
  | { kind: "upgrade"; upgradeId: string };

/**
 * Diffs two snapshots and returns the toast events to show (pure, testable).
 *
 * `prev` is null on the very first frame (nothing to compare → no events).
 * Order is stable for deterministic tests: money, rescue, then one event per
 * newly-owned upgrade in owned-list order.
 */
export function detectToastEvents(
  prev: GameSnapshot | null,
  cur: GameSnapshot,
): ToastEvent[] {
  if (!prev) return [];
  const events: ToastEvent[] = [];

  // Money earned while in range = a delivery / reward payout (spending at a
  // station reduces money, so an increase in range is income, not a purchase).
  const gained = cur.money - prev.money;
  if (cur.station.inRange && gained >= MONEY_EPSILON) {
    events.push({ kind: "money", amountEarned: gained });
  }

  // Emergency fuel rescue arrived (relaxed mode reserve top-up).
  if (cur.emergencyRefuelCount > prev.emergencyRefuelCount) {
    events.push({ kind: "rescue" });
  }

  // Upgrades purchased (new ids appeared in the owned list).
  for (const id of cur.ownedUpgradeIds) {
    if (!prev.ownedUpgradeIds.includes(id)) {
      events.push({ kind: "upgrade", upgradeId: id });
    }
  }

  return events;
}
