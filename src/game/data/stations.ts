/**
 * Station definitions along the single forward route.
 *
 * Seven stations (TODO.md) act as tactical stops: stopping costs time but
 * offers cargo, repairs, refuel, and upgrades. Stations are positioned by world
 * X (metres) and must all fall within the route bounds (see {@link
 * ROUTE_LENGTH_M}). The mid-game locomotive upgrade (loco-2) is sold at a
 * single mid-route station (the repair depot), landing in the middle third of
 * the route so the escalation arrives before the steep late climb.
 */

import { ROUTE_LENGTH_M } from "./route";

/** What a station offers the player when stopped. */
export interface StationServices {
  /** Cargo jobs can be picked up here. */
  cargoPickup: boolean;
  /** Cargo can be delivered / dropped off here. */
  cargoDelivery: boolean;
  /** Damage / wear can be repaired here (for a cost). */
  repair: boolean;
  /** Fuel can be topped up here (for a cost). */
  refuel: boolean;
  /** Upgrades can be purchased here. */
  upgrades: boolean;
  /**
   * Upgrade ids available for purchase at this station (references
   * `Upgrade.id` in `upgrades.ts`). Empty when `upgrades` is false.
   */
  upgradeIds: readonly string[];
}

/** A single station on the route. */
export interface Station {
  /** Stable unique identifier. */
  id: string;
  /** Player-facing name. */
  name: string;
  /** Short region / story flavour label. */
  region: string;
  /** World X position along the route, metres (within route bounds). */
  positionX: number;
  /** Services offered when the train is stopped here. */
  services: StationServices;
}

/**
 * The seven stations, ordered by `positionX` from coast to summit.
 *
 * Spacing (route is 13000 m): stations sit at roughly 400 / 2600 / 3600 /
 * 5600 / 7500 / 8400 / 12900 m, keeping every gap comfortably above a
 * minimum-spacing sanity floor while telling the escape story beat by beat.
 */
export const STATIONS: readonly Station[] = [
  {
    id: "station-port",
    name: "Cinderport Harbour",
    region: "Burning coast / port",
    positionX: 400,
    services: {
      cargoPickup: true,
      cargoDelivery: false,
      repair: false,
      refuel: true,
      upgrades: false,
      upgradeIds: [],
    },
  },
  {
    id: "station-lower-town",
    name: "Ashfall Lower Town",
    region: "Lower town",
    positionX: 2600,
    services: {
      cargoPickup: true,
      cargoDelivery: true,
      repair: true,
      refuel: true,
      upgrades: false,
      upgradeIds: [],
    },
  },
  {
    id: "station-cargo-yard",
    name: "Basin Cargo Yard",
    region: "River cargo yard",
    positionX: 3600,
    services: {
      cargoPickup: true,
      cargoDelivery: true,
      repair: false,
      refuel: true,
      upgrades: false,
      upgradeIds: [],
    },
  },
  {
    id: "station-ash-tunnel",
    name: "Ash Tunnel Depot",
    region: "Ash tunnel depot",
    positionX: 5600,
    services: {
      cargoPickup: true,
      cargoDelivery: true,
      repair: true,
      refuel: false,
      upgrades: true,
      // Cooling-focused kit for the smoky tunnel run.
      upgradeIds: ["upgrade-radiator", "upgrade-cooling-fan"],
    },
  },
  {
    id: "station-repair-depot",
    name: "Ridgeworks Repair Depot",
    region: "Mid-route repair depot",
    positionX: 7500,
    services: {
      cargoPickup: true,
      cargoDelivery: true,
      repair: true,
      refuel: true,
      upgrades: true,
      // The mid-game locomotive upgrade lives here (middle third of route).
      upgradeIds: [
        "upgrade-loco-2",
        "upgrade-heat-resistant",
        "upgrade-sanders",
        "upgrade-brakes",
      ],
    },
  },
  {
    id: "station-mountain-bridge",
    name: "Ravine Bridge Town",
    region: "Mountain bridge",
    positionX: 8400,
    services: {
      cargoPickup: true,
      cargoDelivery: true,
      repair: true,
      refuel: true,
      upgrades: true,
      // Last chance for traction/brake kit before the steep climb.
      upgradeIds: ["upgrade-sanders", "upgrade-brakes"],
    },
  },
  {
    id: "station-summit-village",
    name: "Rescue Summit Village",
    region: "Final climb village / summit",
    positionX: 12900,
    services: {
      cargoPickup: false,
      cargoDelivery: true,
      repair: true,
      refuel: true,
      upgrades: false,
      upgradeIds: [],
    },
  },
];

/** Number of stations on the route. */
export const STATION_COUNT: number = STATIONS.length;

/** Returns the station with the given id, or `undefined` if none matches. */
export function getStationById(id: string): Station | undefined {
  return STATIONS.find((station) => station.id === id);
}

/** Returns true if `id` refers to a known station. */
export function isStationId(id: string): boolean {
  return STATIONS.some((station) => station.id === id);
}

/** Sentinel destination meaning "carry to the finish", not a station. */
export const FINISH_DESTINATION = "finish" as const;

/** The X position of the finish line, metres (end of the route). */
export const FINISH_POSITION_X: number = ROUTE_LENGTH_M;
