/**
 * Locomotive definitions.
 *
 * Two locomotives per TODO.md:
 *  - `loco-1` — diesel-electric starter: balanced, lower power, better fuel
 *    economy, weaker on steep hills / heavy cargo.
 *  - `loco-2` — diesel-hydraulic upgrade: more power and tractive effort,
 *    better cooling, better traction, but burns more fuel and costs money
 *    (purchased mid-route via `upgrade-loco-2`).
 *
 * All stats are in SI units (see per-field comments). Values are plausible
 * starting points for a mid-size diesel loco and are expected to be tuned once
 * the physics step exists.
 */

export interface Locomotive {
  /** Stable unique identifier. */
  id: string;
  /** Player-facing name. */
  name: string;
  /** Short description / flavour. */
  description: string;

  /** Bare locomotive mass (no cargo), kilograms. */
  mass: number;
  /** Maximum engine output power, kilowatts (kW). */
  maxPowerKW: number;
  /**
   * Maximum tractive effort at the rail, newtons (N). Caps how much force the
   * loco can apply before it is power- or adhesion-limited.
   */
  maxTractiveEffortN: number;

  /** Onboard fuel tank capacity, litres (L). */
  fuelCapacity: number;
  /**
   * Fuel burned per unit of engine work, litres per kilowatt-second
   * (L/(kW·s)). Instantaneous burn ≈ fuelBurnRate * demandedPowerKW.
   * Lower is more economical.
   */
  fuelBurnRate: number;

  /**
   * Passive cooling rate of the engine, degrees Celsius per second (°C/s) of
   * temperature shed toward ambient at a reference over-temperature. Higher =
   * sheds heat faster.
   */
  coolingRate: number;
  /**
   * Heat generated per unit of engine work, degrees Celsius per kilowatt-second
   * (°C/(kW·s)). Higher = heats up faster under the same load.
   */
  heatGenerationFactor: number;

  /**
   * Purchase price, in-game money units. The starter is free (already owned);
   * the upgrade costs money and is gated behind `upgrade-loco-2`.
   */
  price: number;
}

/** Diesel-electric starter locomotive (owned from the start). */
export const LOCO_1: Locomotive = {
  id: "loco-1",
  name: "DE-1 \u201cEmber\u201d Diesel-Electric",
  description:
    "Reliable diesel-electric starter. Balanced and economical, but " +
    "underpowered on steep climbs with heavy cargo.",
  mass: 90_000, // kg (~90 t bare loco)
  maxPowerKW: 1_100, // kW
  maxTractiveEffortN: 240_000, // N
  fuelCapacity: 2_500, // L
  fuelBurnRate: 0.00006, // L/(kW·s) — thriftier engine
  coolingRate: 0.9, // °C/s reference cooling
  heatGenerationFactor: 0.0009, // °C/(kW·s) — runs hotter under load
  price: 0, // owned from the start
};

/** Diesel-hydraulic upgrade locomotive (mid-game purchase). */
export const LOCO_2: Locomotive = {
  id: "loco-2",
  name: "DH-2 \u201cSummit\u201d Diesel-Hydraulic",
  description:
    "Powerful diesel-hydraulic upgrade. Hauls heavier loads, climbs harder, " +
    "and stays cooler under load — at the cost of thirstier fuel use and a " +
    "significant purchase price.",
  mass: 108_000, // kg (~108 t — heavier)
  maxPowerKW: 1_800, // kW — more power
  maxTractiveEffortN: 360_000, // N — more tractive effort
  fuelCapacity: 3_000, // L
  fuelBurnRate: 0.00009, // L/(kW·s) — thirstier
  coolingRate: 1.4, // °C/s — better cooling
  heatGenerationFactor: 0.0006, // °C/(kW·s) — runs cooler under load
  price: 14_000, // money units — significant investment
};

/** All locomotives, ordered starter-first. */
export const LOCOMOTIVES: readonly Locomotive[] = [LOCO_1, LOCO_2];

/** Returns the locomotive with the given id, or `undefined` if none matches. */
export function getLocomotiveById(id: string): Locomotive | undefined {
  return LOCOMOTIVES.find((loco) => loco.id === id);
}
