/**
 * Cargo job definitions.
 *
 * Cargo is temptation (TODO.md design pillar 3): heavier jobs pay more but add
 * weight, braking distance, heat, and traction risk. Jobs span light/heavy and
 * low/high pay across origin stations so the player faces real tradeoffs.
 *
 * Every job's destination is *forward* of its origin along the route — either a
 * later station id or the `finish` sentinel — so cargo always travels toward
 * the summit. Origins and destinations reference ids from `stations.ts`.
 */

import {
  FINISH_DESTINATION,
  getStationById,
  isStationId,
  FINISH_POSITION_X,
} from "./stations";

/**
 * Delivery target: a station id string, or the `finish` sentinel. Both are
 * strings at runtime; the alias documents intent for consumers.
 */
export type CargoDestination = string;

/** A single cargo job the player may accept at its origin station. */
export interface CargoJob {
  /** Stable unique identifier. */
  id: string;
  /** Player-facing name. */
  name: string;
  /** Cargo material / type flavour. */
  material: string;
  /** Number of wagons this job adds to the train. */
  wagonCount: number;
  /** Mass of each wagon (including its load), kilograms. */
  weightPerWagonKg: number;
  /** Reward paid on delivery, in-game money units. */
  payment: number;
  /** Origin station id (where the job is offered / picked up). */
  originStationId: string;
  /** Delivery target: a later station id or {@link FINISH_DESTINATION}. */
  destinationStationId: CargoDestination;
  /** Short description / flavour. */
  description: string;
}

/**
 * All cargo jobs.
 *
 * Naming: within a shared origin, the ordering exposes a weight/pay tradeoff —
 * heavier variants pay strictly more than lighter variants from the same
 * origin.
 */
export const CARGO_JOBS: readonly CargoJob[] = [
  // --- Origin: Cinderport Harbour (coast) ---
  {
    id: "cargo-port-mail",
    name: "Evac Mail Pouches",
    material: "Mail & documents",
    wagonCount: 1,
    weightPerWagonKg: 6_000,
    payment: 800,
    originStationId: "station-port",
    destinationStationId: "station-lower-town",
    description:
      "Light, fast delivery to the lower town. Low weight, modest pay — " +
      "an easy warm-up haul.",
  },
  {
    id: "cargo-port-fuel-drums",
    name: "Harbour Fuel Drums",
    material: "Diesel drums",
    wagonCount: 2,
    weightPerWagonKg: 22_000,
    payment: 2_600,
    originStationId: "station-port",
    destinationStationId: "station-cargo-yard",
    description:
      "Heavy drums for the basin yard. Good money, but the weight bites " +
      "on the climb out of the basin.",
  },
  {
    id: "cargo-port-machinery",
    name: "Dock Machinery",
    material: "Steel machinery",
    wagonCount: 3,
    weightPerWagonKg: 30_000,
    payment: 5_200,
    originStationId: "station-port",
    destinationStationId: FINISH_DESTINATION,
    description:
      "Salvaged dock machinery all the way to the summit. Top pay, but a " +
      "brutal load for the starter locomotive on the late steep grade.",
  },

  // --- Origin: Ashfall Lower Town ---
  {
    id: "cargo-lower-medical",
    name: "Medical Supplies",
    material: "Medical crates",
    wagonCount: 1,
    weightPerWagonKg: 9_000,
    payment: 1_400,
    originStationId: "station-lower-town",
    destinationStationId: "station-repair-depot",
    description:
      "Light medical crates for the depot infirmary. Steady pay, minimal " +
      "weight penalty.",
  },
  {
    id: "cargo-lower-stone",
    name: "Quarry Stone",
    material: "Cut stone",
    wagonCount: 3,
    weightPerWagonKg: 28_000,
    payment: 4_100,
    originStationId: "station-lower-town",
    destinationStationId: "station-mountain-bridge",
    description:
      "Heavy stone for the ravine bridge repairs. Pays well, but tests " +
      "traction on the mid-route incline.",
  },

  // --- Origin: Basin Cargo Yard ---
  {
    id: "cargo-yard-timber",
    name: "Timber Bundles",
    material: "Timber",
    wagonCount: 2,
    weightPerWagonKg: 14_000,
    payment: 2_200,
    originStationId: "station-cargo-yard",
    destinationStationId: "station-ash-tunnel",
    description:
      "Bundled timber to the tunnel depot. Moderate weight, fair reward.",
  },
  {
    id: "cargo-yard-ore",
    name: "Iron Ore Hoppers",
    material: "Iron ore",
    wagonCount: 4,
    weightPerWagonKg: 34_000,
    payment: 6_400,
    originStationId: "station-cargo-yard",
    destinationStationId: FINISH_DESTINATION,
    description:
      "Four hoppers of ore to the summit. The richest early payout — and " +
      "the heaviest. Almost demands the loco-2 upgrade.",
  },

  // --- Origin: Ash Tunnel Depot ---
  {
    id: "cargo-tunnel-tools",
    name: "Repair Tools",
    material: "Hand tools",
    wagonCount: 1,
    weightPerWagonKg: 7_000,
    payment: 1_100,
    originStationId: "station-ash-tunnel",
    destinationStationId: "station-repair-depot",
    description: "Light tool crates for the repair depot. Quick, low-risk pay.",
  },
  {
    id: "cargo-tunnel-coal",
    name: "Coal Wagons",
    material: "Coal",
    wagonCount: 3,
    weightPerWagonKg: 26_000,
    payment: 4_000,
    originStationId: "station-ash-tunnel",
    destinationStationId: "station-summit-village",
    description:
      "Coal for the summit village generators. Heavy, but a solid haul if " +
      "the engine stays cool through the tunnel.",
  },

  // --- Origin: Ridgeworks Repair Depot ---
  {
    id: "cargo-depot-parts",
    name: "Bridge Parts",
    material: "Steel girders",
    wagonCount: 2,
    weightPerWagonKg: 20_000,
    payment: 3_000,
    originStationId: "station-repair-depot",
    destinationStationId: "station-mountain-bridge",
    description:
      "Girders for the ravine bridge. Short hop, decent pay, manageable " +
      "weight with the upgraded loco.",
  },

  // --- Origin: Ravine Bridge Town ---
  {
    id: "cargo-bridge-rescue",
    name: "Rescue Equipment",
    material: "Rescue gear",
    wagonCount: 2,
    weightPerWagonKg: 12_000,
    payment: 3_800,
    originStationId: "station-mountain-bridge",
    destinationStationId: FINISH_DESTINATION,
    description:
      "Critical rescue gear for the summit. Premium pay for a moderate load " +
      "hauled up the steepest climb.",
  },
];

/** Returns the cargo job with the given id, or `undefined` if none matches. */
export function getCargoJobById(id: string): CargoJob | undefined {
  return CARGO_JOBS.find((job) => job.id === id);
}

/** Total mass a cargo job adds to the train, kilograms. */
export function getCargoJobTotalWeightKg(job: CargoJob): number {
  return job.wagonCount * job.weightPerWagonKg;
}

/**
 * Resolves the world X position (metres) of a job's destination: a station's
 * `positionX`, or the finish line for {@link FINISH_DESTINATION}. Returns
 * `undefined` if the destination id is unknown.
 */
export function getCargoDestinationX(job: CargoJob): number | undefined {
  if (job.destinationStationId === FINISH_DESTINATION) {
    return FINISH_POSITION_X;
  }
  const station = getStationById(job.destinationStationId);
  return station?.positionX;
}

/** Returns true if the destination is a known station id or the finish. */
export function isValidCargoDestination(dest: CargoDestination): boolean {
  return dest === FINISH_DESTINATION || isStationId(dest);
}
