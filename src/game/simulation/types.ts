/**
 * Shared simulation types.
 *
 * These describe the internal mutable sim state slices consumed by the pure
 * per-system functions, and the read-only {@link GameSnapshot} the sim exposes
 * to rendering / UI / tests. The snapshot exposes everything docs/07-tech.md lists:
 * position, speed, grade, fuel, temperature + state, traction/slip, damage,
 * cargo, money, station proximity + interactions, fire front + distance, timer,
 * and win/fail state + reason.
 */

import type { RngState } from "./rng";

/** Player-issued action for a tick. Fields default to "no change". */
export interface TrainAction {
  /** Throttle demand, 0..1. */
  throttle?: number;
  /** Brake demand, 0..1. */
  brake?: number;
  /** Reverse direction toggle (true = travelling backward). */
  reverse?: boolean;
  /** Generic "interact with nearby station" trigger. */
  interact?: boolean;
  /** Accept (pick up) the cargo job with this id at the current station. */
  acceptCargoId?: string;
  /** Repair damage at the current station (costs money). */
  repair?: boolean;
  /** Buy the upgrade with this id at the current station (costs money). */
  buyUpgradeId?: string;
  /** Detach (drop) the accepted cargo job with this id to shed weight. */
  detachCargoId?: string;
  /** Refuel to full at the current station (costs money). */
  refuel?: boolean;
}

/** Temperature threshold state. */
export type TemperatureState = "safe" | "warning" | "critical" | "failure";

/** Wheel-slip state. */
export type TractionState = "gripping" | "slipping";

/** Overall run outcome. */
export type RunState = "running" | "won" | "failed";

/** Reason a run ended (only meaningful when not "running"). */
export type RunEndReason =
  "none" | "reached-finish" | "time-out" | "fire-caught" | "engine-failure";

/** An accepted cargo job currently coupled to the train. */
export interface ActiveCargo {
  /** Cargo job id (references `cargo.ts`). */
  jobId: string;
  /** Wagons this job contributes. */
  wagonCount: number;
  /** Total mass this job adds, kilograms. */
  totalWeightKg: number;
  /** Delivery destination (station id or finish sentinel). */
  destinationStationId: string;
  /** Payment on delivery. */
  payment: number;
}

/** Physics state slice (longitudinal motion). */
export interface PhysicsState {
  /** World X position along the route, metres. */
  positionX: number;
  /** Signed speed, m/s. Positive = forward, negative = reversing. */
  speed: number;
  /** True when the player has selected reverse. */
  reverse: boolean;
}

/** Temperature state slice. */
export interface ThermalState {
  /** Current engine temperature, °C. */
  tempC: number;
}

/** Traction state slice. */
export interface TractionSlice {
  /** Current slip state. */
  state: TractionState;
  /** Slip ratio (demanded / available effort); 1.0 = at the grip limit. */
  slipRatio: number;
}

/** Wear / damage state slice. */
export interface WearState {
  /** Engine/general damage, 0 (pristine) .. 1 (broken). */
  damage: number;
  /** Wheel/drive damage, 0 .. 1. */
  wheelDamage: number;
}

/** Fuel state slice. */
export interface FuelState {
  /** Remaining fuel, litres. */
  litres: number;
}

/** Engine (rotational) state slice. */
export interface EngineState {
  /** Crankshaft speed, revolutions per minute (RPM). */
  rpm: number;
}

/** Fire-front state slice. */
export interface FireState {
  /** Fire-front world X position, metres. */
  positionX: number;
  /** Seconds elapsed since run start (drives the fire ramp). */
  elapsedS: number;
}

/** Full internal simulation state (mutable). */
export interface SimState {
  physics: PhysicsState;
  thermal: ThermalState;
  traction: TractionSlice;
  wear: WearState;
  fuel: FuelState;
  engine: EngineState;
  fire: FireState;

  /** Active locomotive id (references `locomotives.ts`). */
  locomotiveId: string;
  /** Owned upgrade ids (references `upgrades.ts`). */
  ownedUpgradeIds: string[];
  /** Currently coupled cargo jobs. */
  cargo: ActiveCargo[];
  /** Player money. */
  money: number;

  /**
   * Whether the advancing fire front and the run timer are active. When false
   * the fire never advances, the timer never counts down, and neither can end
   * the run (a relaxed / no-pressure mode chosen at the intro screen).
   */
  fireEnabled: boolean;

  /** Remaining countdown time, seconds. */
  timeRemainingS: number;

  /** Last-applied action inputs (persist between ticks until changed). */
  input: {
    throttle: number;
    brake: number;
  };

  /** Overall run state and reason. */
  runState: RunState;
  runEndReason: RunEndReason;

  /** Seeded RNG stream position. */
  rng: RngState;
}

/** An interaction available at the nearby station right now. */
export interface AvailableInteraction {
  kind: "pickup-cargo" | "deliver-cargo" | "repair" | "refuel" | "buy-upgrade";
  /** Referenced id (cargo job id, upgrade id) where relevant. */
  id?: string;
  /** Money cost of the interaction where known. */
  cost?: number;
  /** Human-readable label. */
  label: string;
}

/** Station proximity info for the snapshot. */
export interface StationProximity {
  /** Nearest station id, or null if none. */
  stationId: string | null;
  /** Nearest station name, or null. */
  stationName: string | null;
  /** Signed distance to the nearest station, metres (positive = ahead). */
  distanceM: number;
  /** True when stopped within interaction range of the station. */
  inRange: boolean;
  /** Interactions currently available (empty unless stopped & in range). */
  interactions: AvailableInteraction[];
}

/** Read-only snapshot exposed to rendering / UI / tests. */
export interface GameSnapshot {
  /** World X position, metres. */
  positionX: number;
  /** Signed speed, m/s. */
  speed: number;
  /** Grade at the current position (rise/run). */
  grade: number;
  /** True when reverse is selected. */
  reverse: boolean;

  /** Remaining fuel, litres. */
  fuelLitres: number;
  /** Fuel tank capacity for the active loco, litres. */
  fuelCapacity: number;

  /** Engine temperature, °C. */
  temperatureC: number;
  /** Temperature threshold state. */
  temperatureState: TemperatureState;

  /** Engine crankshaft speed, revolutions per minute (RPM). */
  engineRpm: number;

  /** Wheel-slip state. */
  tractionState: TractionState;
  /** Slip ratio. */
  slipRatio: number;

  /** Engine/general damage, 0..1. */
  damage: number;
  /** Wheel damage, 0..1. */
  wheelDamage: number;

  /** Total train mass (loco + cargo), kilograms. */
  totalMassKg: number;
  /** Coupled cargo jobs. */
  cargo: ActiveCargo[];

  /** Player money. */
  money: number;
  /** Active locomotive id. */
  locomotiveId: string;
  /** Owned upgrade ids. */
  ownedUpgradeIds: string[];

  /** Station proximity + available interactions. */
  station: StationProximity;

  /**
   * Whether the fire front and run timer are active. When false, consumers
   * should hide the fire / timer UI and skip fire-proximity / low-time
   * warnings — the run cannot be lost to fire or the clock.
   */
  fireEnabled: boolean;

  /** Fire-front world X position, metres. */
  fireFrontX: number;
  /** Distance from fire front to train, metres (positive = fire is behind). */
  fireDistanceM: number;

  /** Remaining countdown time, seconds. */
  timeRemainingS: number;

  /** Overall run state. */
  runState: RunState;
  /** Reason the run ended. */
  runEndReason: RunEndReason;

  /** Fraction of the route completed, 0..1. */
  progress: number;
}
