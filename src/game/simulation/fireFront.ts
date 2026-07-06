/**
 * Advancing fire-front model.
 *
 * The fire chases the train from behind. Its speed is a base rate plus a mild
 * ramp that grows with elapsed time, so lingering late is punished harder than
 * lingering early. When the fire reaches the train (distance <= catch
 * distance), the run fails.
 *
 * Position is measured in the same world-X frame as the train, starting behind
 * the start line. Distance-to-fire is `trainX - fireX` (positive = fire behind,
 * which is the safe case).
 */

import {
  FIRE_CATCH_DISTANCE,
  FIRE_RAMP_ACCEL,
  FIRE_BASE_SPEED,
} from "./constants";

/** Current fire speed (m/s) given elapsed run time. */
export function fireSpeedAt(elapsedS: number): number {
  return FIRE_BASE_SPEED + FIRE_RAMP_ACCEL * elapsedS;
}

/** Result of advancing the fire one step. */
export interface FireStepResult {
  /** New fire-front world X, metres. */
  positionX: number;
  /** New elapsed time, seconds. */
  elapsedS: number;
}

/** Advances the fire front one tick. */
export function stepFire(
  positionX: number,
  elapsedS: number,
  dt: number,
): FireStepResult {
  const speed = fireSpeedAt(elapsedS);
  return {
    positionX: positionX + speed * dt,
    elapsedS: elapsedS + dt,
  };
}

/** Distance from fire front to the train, metres (positive = fire behind). */
export function distanceToFire(trainX: number, fireX: number): number {
  return trainX - fireX;
}

/** True when the fire has caught (or passed) the train. */
export function isCaughtByFire(trainX: number, fireX: number): boolean {
  return distanceToFire(trainX, fireX) <= FIRE_CATCH_DISTANCE;
}
