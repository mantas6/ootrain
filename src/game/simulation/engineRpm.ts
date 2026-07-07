/**
 * Engine RPM model.
 *
 * The crankshaft speed (RPM) is driven by throttle position: idle RPM at
 * throttle 0, rising linearly toward max RPM at full throttle. RPM does not
 * snap to its target — it approaches with a first-order lag so the engine
 * audibly spools up/down like a real diesel, without excessive inertia.
 *
 * Both functions are pure and frame-rate independent (the exponential approach
 * uses `dt`), so they are cheap to unit test in plain Node.
 */

import {
  ENGINE_IDLE_RPM,
  ENGINE_MAX_RPM,
  ENGINE_RPM_RESPONSE_RATE,
} from "./constants";

/** Target RPM for a throttle position (0..1): idle at 0, max at full. */
export function targetRpm(throttle: number): number {
  const t = throttle < 0 ? 0 : throttle > 1 ? 1 : throttle;
  return ENGINE_IDLE_RPM + (ENGINE_MAX_RPM - ENGINE_IDLE_RPM) * t;
}

/**
 * Advances engine RPM one step toward its throttle target with first-order lag.
 * The blend factor `1 - exp(-rate * dt)` makes the approach independent of the
 * tick size, so the spool feel is identical at any timestep.
 */
export function stepEngineRpm(
  currentRpm: number,
  throttle: number,
  dt: number,
): number {
  if (dt <= 0) return currentRpm;
  const target = targetRpm(throttle);
  const alpha = 1 - Math.exp(-ENGINE_RPM_RESPONSE_RATE * dt);
  return currentRpm + (target - currentRpm) * alpha;
}
