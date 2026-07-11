/**
 * Emergency fuel reserve — a soft-lock recovery for relaxed mode.
 *
 * With the fire disabled nothing ends the run, so a player who runs the tank
 * dry between stations with no money to refuel can coast to a permanent halt.
 * To keep the relaxed mode finishable, a rescue crew grants a small emergency
 * top-up once the train has been stranded (out of fuel and stationary, with no
 * way to self-rescue) for {@link EMERGENCY_REFUEL_DELAY_S} seconds.
 *
 * This is a pure, deterministic timer — the caller owns the state and applies
 * the granted fuel / money penalty. It touches no RNG.
 */

import { EMERGENCY_REFUEL_DELAY_S } from "./constants";

/** Inputs for one emergency-reserve step. */
export interface EmergencyFuelInput {
  /** Whether the tank is empty. */
  outOfFuel: boolean;
  /** Whether the train is effectively stopped. */
  stationary: boolean;
  /**
   * Whether the player could rescue themselves right now (stopped in range of a
   * refuel station with money to spend). When true the stranded timer resets —
   * they are not actually stuck.
   */
  canSelfRescue: boolean;
  /** Seconds already accumulated stranded. */
  strandedS: number;
  /** Tick duration, seconds. */
  dt: number;
}

/** Result of one emergency-reserve step. */
export interface EmergencyFuelResult {
  /** New stranded-timer value, seconds. */
  strandedS: number;
  /** True on the tick a rescue is granted (caller adds fuel + penalty). */
  triggered: boolean;
}

/**
 * Advances the stranded timer and reports when a rescue should fire. The timer
 * only runs while the train is genuinely stuck; any escape route resets it.
 */
export function stepEmergencyFuel(
  input: EmergencyFuelInput,
): EmergencyFuelResult {
  if (!input.outOfFuel || !input.stationary || input.canSelfRescue) {
    return { strandedS: 0, triggered: false };
  }
  const strandedS = input.strandedS + input.dt;
  if (strandedS >= EMERGENCY_REFUEL_DELAY_S) {
    return { strandedS: 0, triggered: true };
  }
  return { strandedS, triggered: false };
}
