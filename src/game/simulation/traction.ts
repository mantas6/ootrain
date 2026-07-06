/**
 * Wheel-slip / traction model.
 *
 * Available adhesion (grip) is a coefficient times the weight on the driven
 * axles: `grip = adhesionCoeff * weightOnDrivers * g`. The adhesion coefficient
 * is the base rail coefficient plus any traction upgrades (sanders).
 *
 * If the *demanded* tractive effort exceeds the available grip, the wheels slip:
 *   - Effective tractive effort is capped at the available grip (excess force is
 *     not transferred to the rail).
 *   - The ungripped power is wasted as heat (extra engine heating).
 *   - Wheel/drive damage accrues over time while slipping.
 *
 * The slip ratio reported is `demanded / available` (>= 1 means at/over the
 * limit). Weight-on-drivers uses the *locomotive* mass only, since wagons are
 * unpowered dead weight that still must be dragged up the hill.
 */

import {
  BASE_ADHESION_COEFF,
  GRAVITY,
  SLIP_ONSET_RATIO,
  SLIP_WASTE_HEAT_FACTOR,
  SLIP_WHEEL_DAMAGE_RATE,
  WEIGHT_ON_DRIVERS_FRACTION,
} from "./constants";
import type { TractionState } from "./types";

/** Inputs describing traction capability for the current step. */
export interface TractionInput {
  /** Locomotive mass bearing on the drivers, kg. */
  locoMassKg: number;
  /** Extra adhesion from upgrades (e.g. sanders), dimensionless fraction. */
  tractionBonus: number;
  /** Demanded tractive effort before traction limiting, N. */
  demandedEffortN: number;
}

/** Result of evaluating traction for a step. */
export interface TractionResult {
  /** Effort actually transferred to the rail, N (<= demanded). */
  effectiveEffortN: number;
  /** Available grip (max transferable effort), N. */
  availableGripN: number;
  /** Slip ratio: demanded / available (>= 1 means slipping). */
  slipRatio: number;
  /** Slip state. */
  state: TractionState;
  /** Ungripped (wasted) effort, N. */
  wastedEffortN: number;
}

/** Computes the maximum tractive effort the rail can transfer (grip), N. */
export function computeAvailableGrip(
  locoMassKg: number,
  tractionBonus: number,
): number {
  const coeff = BASE_ADHESION_COEFF + tractionBonus;
  const weightOnDrivers = locoMassKg * WEIGHT_ON_DRIVERS_FRACTION * GRAVITY;
  return coeff * weightOnDrivers;
}

/**
 * Evaluates traction: caps effort at available grip and reports slip state.
 */
export function evaluateTraction(input: TractionInput): TractionResult {
  const availableGripN = computeAvailableGrip(
    input.locoMassKg,
    input.tractionBonus,
  );
  const demanded = Math.max(0, input.demandedEffortN);

  const slipRatio = availableGripN > 0 ? demanded / availableGripN : 0;
  const slipping = slipRatio > SLIP_ONSET_RATIO;

  const effectiveEffortN = Math.min(demanded, availableGripN);
  const wastedEffortN = Math.max(0, demanded - effectiveEffortN);

  return {
    effectiveEffortN,
    availableGripN,
    slipRatio,
    state: slipping ? "slipping" : "gripping",
    wastedEffortN,
  };
}

/**
 * Extra heat (°C) generated this tick from wasted (slipping) power.
 * Wasted power ≈ wastedEffort * wheel surface speed; we approximate wheel speed
 * with the demanded effort's would-be delivery speed, but to keep it simple and
 * stable we scale wasted force by a factor and the tick duration.
 */
export function slipWasteHeat(
  wastedEffortN: number,
  speedMagAbs: number,
  dt: number,
): number {
  // Wasted power in kW ≈ wastedEffort(N) * slipSurfaceSpeed(m/s) / 1000.
  // At low speed the wheels still spin, so enforce a minimum surface speed.
  const surfaceSpeed = Math.max(speedMagAbs, 2);
  const wastedPowerKW = (wastedEffortN * surfaceSpeed) / 1000;
  return wastedPowerKW * SLIP_WASTE_HEAT_FACTOR * dt;
}

/** Wheel damage (0..1 units) accrued this tick while slipping. */
export function slipWheelDamage(state: TractionState, dt: number): number {
  return state === "slipping" ? SLIP_WHEEL_DAMAGE_RATE * dt : 0;
}
