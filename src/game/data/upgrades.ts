/**
 * Purchasable upgrade definitions.
 *
 * Upgrades are bought at stations (see `stations.ts`) and modify locomotive
 * behaviour for later physics steps. The mid-game locomotive purchase itself is
 * modelled as an upgrade (`upgrade-loco-2`) so station upgrade lists can
 * reference it by id.
 *
 * Effect fields are optional and additive; a given upgrade only sets the fields
 * it changes. All effect units are documented per field.
 */

import { LOCO_2 } from "./locomotives";

/** Typed, additive effects an upgrade applies to the locomotive. */
export interface UpgradeEffects {
  /**
   * Extra passive cooling, degrees Celsius per second (°C/s), added to the
   * locomotive's `coolingRate`.
   */
  coolingBonus?: number;
  /**
   * Traction / adhesion multiplier bonus, dimensionless fraction added to the
   * effective adhesion (e.g. 0.15 = +15% grip before wheel slip).
   */
  tractionBonus?: number;
  /**
   * Extra maximum safe temperature, degrees Celsius (°C), added to the
   * overheating threshold before the warning/critical states trigger.
   */
  maxTempBonus?: number;
  /**
   * Extra braking force, newtons (N), added to the locomotive's brake output.
   */
  brakeForceBonus?: number;
  /**
   * Fractional reduction in heat generated under load, dimensionless
   * (e.g. 0.2 = 20% less heat per unit work). Applied to
   * `heatGenerationFactor`.
   */
  heatGenerationReduction?: number;
  /**
   * If set, purchasing this upgrade swaps the active locomotive to this id
   * (references `Locomotive.id`). Used by the mid-game loco-2 purchase.
   */
  unlockLocomotiveId?: string;
}

/** A purchasable upgrade. */
export interface Upgrade {
  /** Stable unique identifier. */
  id: string;
  /** Player-facing name. */
  name: string;
  /** Short description / flavour. */
  description: string;
  /** Purchase price, in-game money units (positive). */
  price: number;
  /** Typed effects applied when owned. */
  effects: UpgradeEffects;
}

/** All purchasable upgrades. */
export const UPGRADES: readonly Upgrade[] = [
  {
    id: "upgrade-radiator",
    name: "High-Capacity Radiator",
    description:
      "A larger radiator core sheds engine heat faster, buying more time " +
      "under sustained load.",
    price: 2_200,
    effects: {
      coolingBonus: 0.5, // +0.5 °C/s passive cooling
    },
  },
  {
    id: "upgrade-cooling-fan",
    name: "Reinforced Cooling Fan",
    description:
      "A stronger engine-driven fan improves airflow, cutting the heat " +
      "generated under heavy throttle.",
    price: 1_800,
    effects: {
      coolingBonus: 0.3, // +0.3 °C/s passive cooling
      heatGenerationReduction: 0.15, // 15% less heat per unit work
    },
  },
  {
    id: "upgrade-heat-resistant",
    name: "Heat-Resistant Engine Parts",
    description:
      "Ceramic-coated internals tolerate higher temperatures before damage " +
      "sets in, raising the safe ceiling.",
    price: 3_000,
    effects: {
      maxTempBonus: 25, // +25 °C to the overheating threshold
    },
  },
  {
    id: "upgrade-sanders",
    name: "Rail Sanders & Traction Control",
    description:
      "Sand dispensers and torque limiting improve grip, reducing wheel " +
      "slip on steep grades with heavy cargo.",
    price: 2_600,
    effects: {
      tractionBonus: 0.18, // +18% effective adhesion
    },
  },
  {
    id: "upgrade-brakes",
    name: "Upgraded Brake System",
    description:
      "Higher-capacity brakes shorten stopping distance and reduce " +
      "harsh-braking wear.",
    price: 2_000,
    effects: {
      brakeForceBonus: 60_000, // +60 kN braking force
    },
  },
  {
    id: "upgrade-loco-2",
    name: `Buy ${LOCO_2.name}`,
    description:
      "Swap to the powerful diesel-hydraulic locomotive: more power, better " +
      "cooling and traction, at the cost of thirstier fuel use.",
    // Priced from the locomotive's purchase price so the two stay in sync.
    price: LOCO_2.price,
    effects: {
      unlockLocomotiveId: LOCO_2.id, // swaps active loco to loco-2
    },
  },
];

/** Id of the upgrade that unlocks the mid-game locomotive. */
export const LOCO_2_UPGRADE_ID = "upgrade-loco-2";

/** Returns the upgrade with the given id, or `undefined` if none matches. */
export function getUpgradeById(id: string): Upgrade | undefined {
  return UPGRADES.find((upgrade) => upgrade.id === id);
}

/** Returns true if `id` refers to a known upgrade. */
export function isUpgradeId(id: string): boolean {
  return UPGRADES.some((upgrade) => upgrade.id === id);
}
