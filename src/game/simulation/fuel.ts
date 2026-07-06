/**
 * Fuel burn and refuelling.
 *
 * Fuel is consumed in proportion to delivered engine power (per the loco's
 * `fuelBurnRate`, L/(kW·s)) plus a small idle draw for auxiliaries. When the
 * tank is empty the engine can deliver no power (no thrust) — but this is not an
 * instant fail: the train can still coast/roll, and the fire will eventually
 * catch it.
 *
 * Refuelling (at stations, for money) tops the tank back to capacity and costs
 * money per litre added.
 */

import { IDLE_FUEL_BURN_L_PER_S, REFUEL_COST_PER_L } from "./constants";

/** Litres burned this tick for a given delivered power. */
export function computeFuelBurn(
  deliveredPowerKW: number,
  fuelBurnRate: number,
  dt: number,
): number {
  const powerBurn = deliveredPowerKW * fuelBurnRate * dt;
  const idleBurn = IDLE_FUEL_BURN_L_PER_S * dt;
  return powerBurn + idleBurn;
}

/** Subtracts burned fuel from the tank, clamped at empty. */
export function burnFuel(litres: number, burned: number): number {
  return Math.max(0, litres - burned);
}

/** True when the tank is effectively empty (no usable fuel). */
export function isEmpty(litres: number): boolean {
  return litres <= 0;
}

/** Result of a refuel attempt. */
export interface RefuelResult {
  /** New fuel level, litres. */
  litres: number;
  /** New money balance. */
  money: number;
  /** True if any fuel was added. */
  refuelled: boolean;
}

/**
 * Refuels as much as the player can afford, up to the tank capacity. Cost is
 * REFUEL_COST_PER_L per litre added.
 */
export function refuel(
  litres: number,
  capacity: number,
  money: number,
): RefuelResult {
  const needed = capacity - litres;
  if (needed <= 0 || money <= 0) {
    return { litres, money, refuelled: false };
  }

  const fullCost = needed * REFUEL_COST_PER_L;
  if (money >= fullCost) {
    return { litres: capacity, money: money - fullCost, refuelled: true };
  }

  // Partial refuel with available money.
  const affordableLitres = money / REFUEL_COST_PER_L;
  return {
    litres: litres + affordableLitres,
    money: 0,
    refuelled: true,
  };
}
