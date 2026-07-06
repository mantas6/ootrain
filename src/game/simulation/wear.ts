/**
 * Wear / damage accumulation and repair.
 *
 * Damage grows from four sources (TODO.md): overheating (critical temperature
 * band), wheel slip abuse (handled in traction.ts, folded into wheel damage
 * here), harsh braking (heavy brake at speed), and overloading (train far
 * heavier than the loco is rated for). Damage worsens heat generation and caps
 * available power (applied in temperature.ts / Game via the constants).
 *
 * Repair (at stations, for money) reduces damage back toward pristine.
 */

import {
  HARSH_BRAKE_DAMAGE_RATE,
  HARSH_BRAKE_SPEED_THRESHOLD,
  MAX_DAMAGE,
  OVERHEAT_DAMAGE_RATE,
  OVERLOAD_DAMAGE_RATE,
  OVERLOAD_MASS_MULTIPLE,
  DAMAGE_POWER_PENALTY,
  REPAIR_COST_PER_DAMAGE,
} from "./constants";
import type { TemperatureState } from "./types";

/** Inputs describing wear accrual for a step. */
export interface WearInput {
  /** Temperature threshold state (critical accrues overheat damage). */
  temperatureState: TemperatureState;
  /** Brake demand, 0..1. */
  brake: number;
  /** Absolute speed, m/s. */
  speedMagAbs: number;
  /** Total train mass, kg. */
  totalMassKg: number;
  /** Locomotive mass, kg (overload baseline). */
  locoMassKg: number;
  /** Tick duration, seconds. */
  dt: number;
}

/** Damage (0..1 units) accrued this tick from all wear sources. */
export function computeDamageAccrual(input: WearInput): number {
  let damage = 0;

  // Overheating: only in the critical band (failure ends the run anyway).
  if (input.temperatureState === "critical") {
    damage += OVERHEAT_DAMAGE_RATE * input.dt;
  }

  // Harsh braking: heavy brake while moving fast.
  if (input.brake > 0.6 && input.speedMagAbs > HARSH_BRAKE_SPEED_THRESHOLD) {
    damage += HARSH_BRAKE_DAMAGE_RATE * input.brake * input.dt;
  }

  // Overloading: train much heavier than the loco is rated for.
  const overloadThreshold = input.locoMassKg * OVERLOAD_MASS_MULTIPLE;
  if (input.totalMassKg > overloadThreshold) {
    damage += OVERLOAD_DAMAGE_RATE * input.dt;
  }

  return damage;
}

/** Adds accrued damage to a current value, clamped to [0, MAX_DAMAGE]. */
export function applyDamage(current: number, accrued: number): number {
  return Math.min(MAX_DAMAGE, Math.max(0, current + accrued));
}

/**
 * Effective max-power multiplier from damage. Full damage removes
 * DAMAGE_POWER_PENALTY of the power.
 */
export function damagePowerFactor(damage: number): number {
  return 1 - DAMAGE_POWER_PENALTY * damage;
}

/** Money cost to repair `damage` units back to pristine. */
export function repairCost(damage: number): number {
  return Math.ceil(damage * REPAIR_COST_PER_DAMAGE);
}

/** Result of a repair attempt. */
export interface RepairResult {
  /** New engine damage. */
  damage: number;
  /** New wheel damage. */
  wheelDamage: number;
  /** New money balance. */
  money: number;
  /** True if the repair happened (player could afford some/all). */
  repaired: boolean;
}

/**
 * Repairs as much combined damage as the player can afford, cheapest-first
 * fully. Repairs engine and wheel damage together (total). If the player can
 * afford a full repair, both are set to 0; otherwise damage is reduced
 * proportionally by the affordable fraction.
 */
export function repair(
  damage: number,
  wheelDamage: number,
  money: number,
): RepairResult {
  const totalDamage = damage + wheelDamage;
  if (totalDamage <= 0 || money <= 0) {
    return { damage, wheelDamage, money, repaired: false };
  }

  const fullCost = repairCost(totalDamage);
  if (money >= fullCost) {
    return {
      damage: 0,
      wheelDamage: 0,
      money: money - fullCost,
      repaired: true,
    };
  }

  // Partial repair: reduce both by the affordable fraction.
  const fraction = money / fullCost;
  return {
    damage: damage * (1 - fraction),
    wheelDamage: wheelDamage * (1 - fraction),
    money: 0,
    repaired: true,
  };
}
