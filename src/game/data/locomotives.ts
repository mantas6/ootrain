/**
 * Locomotive definitions.
 *
 * Two locomotives per docs/04-cargo-locomotives.md:
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
  // Raised from 1100 kW to buff acceleration in the power-limited region (above
  // the low-speed grip cap, tractive effort = power / speed, so this is what
  // makes the train pull harder up to cruise). fuelBurnRate is cut in step
  // below so per-tank WORK — and thus the whole fuel/refuel balance — is held.
  maxPowerKW: 1_300, // kW
  // Raised from 240 kN to buff low-speed acceleration (launch is effort/grip
  // limited, not power limited). Kept just above the bare-loco adhesion grip
  // (~291 kN at BASE_ADHESION_COEFF) so a hard launch still bites the rail and
  // slip stays possible.
  maxTractiveEffortN: 300_000, // N
  fuelCapacity: 2_500, // L
  // Cut from 0.013 in step with the +18% power bump so per-tank WORK — and thus
  // the whole fuel/refuel balance — is held. Snappier acceleration shaves a
  // little low-speed strain-floor time, so the cut is slightly less than the
  // raw power ratio (≈0.0115 vs 0.013/1.18≈0.011) to keep loco-1 unable to
  // reach the repair depot from the port on one tank (see constants.ts "Fuel").
  fuelBurnRate: 0.0115, // L/(kW·s) — see constants.ts "Fuel" block
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
  maxPowerKW: 2_100, // kW — more power (buffed from 1800 for snappier accel)
  // Raised from 360 kN in step with loco-1's effort buff and the higher
  // adhesion coeff; stays above its bare-loco grip (~350 kN) so slip remains
  // possible at a standstill while launches are snappier.
  maxTractiveEffortN: 440_000, // N — more tractive effort
  fuelCapacity: 6_000, // L — big tank; must clear the finale (see constants.ts)
  // Cut from 0.014 in step with the +16.7% power bump (0.014 / 1.167 ≈ 0.012)
  // so per-tank work — and the finale headroom — is preserved. Still thirstier
  // per unit work than loco-1.
  fuelBurnRate: 0.012, // L/(kW·s) — thirstier per unit work than loco-1
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
