/**
 * Route-based longitudinal train physics.
 *
 * Pure functions computing the forces on the train and integrating them into
 * speed and position. The model is 1-D along the route: the only spatial input
 * is the grade at the current position. Forces (all newtons, along travel):
 *
 *   - Tractive effort: from throttle & engine power. Effort is limited by the
 *     flat `maxTractiveEffortN` cap at low speed (constant-effort region) and by
 *     available power (P / v) at higher speed (power-limited region).
 *   - Grade resistance: mass * g * grade (opposes climbing, aids descending).
 *   - Rolling resistance: coeff * mass * g, always opposing motion.
 *   - Aero drag: coeff * speed², always opposing motion.
 *   - Brake force: up to the brake capacity, always opposing motion.
 *
 * Traction (wheel slip) may cap the *effective* tractive effort below the
 * demanded value; that capping is applied by the caller (see traction.ts) and
 * passed in as `effectiveTractiveEffortN`. This module computes the *demanded*
 * effort so traction can decide how much of it actually grips.
 */

import {
  AERO_DRAG_COEFF,
  BASE_BRAKE_FORCE_N,
  GRAVITY,
  ROLLING_RESISTANCE_COEFF,
  STOP_EPSILON,
  TRACTIVE_EFFORT_BASE_SPEED,
} from "./constants";

/** Inputs describing the loco's capability for a physics step. */
export interface TractiveCapability {
  /** Maximum engine power available this tick, watts. */
  maxPowerW: number;
  /** Maximum tractive effort at the rail, newtons. */
  maxTractiveEffortN: number;
}

/**
 * Computes the *demanded* tractive effort (N) for a given throttle and speed.
 *
 * At low speed (|v| <= base speed) the loco can deliver its full effort cap. As
 * speed rises, effort is limited by power: F = P / v. The returned effort is
 * always the smaller of the effort cap and the power limit, scaled by throttle.
 * Sign is positive (magnitude); the caller applies travel direction.
 */
export function computeDemandedTractiveEffort(
  throttle: number,
  speed: number,
  cap: TractiveCapability,
): number {
  const t = clamp01(throttle);
  if (t <= 0) {
    return 0;
  }
  const effortCap = cap.maxTractiveEffortN * t;
  const availablePowerW = cap.maxPowerW * t;
  const speedMag = Math.max(Math.abs(speed), TRACTIVE_EFFORT_BASE_SPEED);
  const powerLimitedEffort = availablePowerW / speedMag;
  return Math.min(effortCap, powerLimitedEffort);
}

/** Rolling resistance magnitude (N), always opposing motion. */
export function computeRollingResistance(massKg: number): number {
  return ROLLING_RESISTANCE_COEFF * massKg * GRAVITY;
}

/** Aerodynamic drag magnitude (N) at a given speed, always opposing motion. */
export function computeAeroDrag(speed: number): number {
  return AERO_DRAG_COEFF * speed * speed;
}

/**
 * Grade resistance (N) as a *signed force along the forward direction*.
 * Positive grade (uphill forward) yields a negative (retarding) force when
 * moving forward. Returned value is the force acting in the +X direction:
 *   F_grade = -mass * g * grade
 * so climbing forward (grade > 0) pulls the train back (negative).
 */
export function computeGradeForce(massKg: number, grade: number): number {
  return -massKg * GRAVITY * grade;
}

/** Total available brake force (N) including any upgrade bonus. */
export function computeBrakeCapacity(brakeForceBonusN: number): number {
  return BASE_BRAKE_FORCE_N + brakeForceBonusN;
}

/** Result of a single physics integration step. */
export interface PhysicsStepResult {
  /** New signed speed, m/s. */
  speed: number;
  /** New world X position, metres. */
  positionX: number;
  /** Net signed force applied this step, N (for diagnostics/heat). */
  netForceN: number;
}

/** Inputs to a physics integration step. */
export interface PhysicsStepInput {
  /** Current signed speed, m/s. */
  speed: number;
  /** Current position, metres. */
  positionX: number;
  /** True when reverse is selected. */
  reverse: boolean;
  /** Total train mass, kg. */
  massKg: number;
  /** Grade at the current position (rise/run). */
  grade: number;
  /**
   * Effective (post-traction) tractive-effort magnitude actually transferred to
   * the rail, N. The caller (Game) computes demanded effort and then clamps it
   * via traction before passing it here.
   */
  effectiveTractiveEffortN: number;
  /** Brake demand, 0..1. */
  brake: number;
  /** Total brake capacity, N. */
  brakeCapacityN: number;
  /** Tick duration, seconds. */
  dt: number;
}

/**
 * Integrates one physics step (semi-implicit Euler on speed then position).
 *
 * Direction handling: tractive effort pushes in the selected travel direction
 * (forward, or backward when reversing). Resistances (rolling, aero, brake)
 * always oppose the current velocity. Grade acts by gravity irrespective of
 * intent. If braking/resistance would reverse the sign of velocity within the
 * tick (i.e. bring the train to a stop), the train is snapped to rest to avoid
 * numerical jitter around zero.
 */
export function stepPhysics(input: PhysicsStepInput): PhysicsStepResult {
  const {
    speed,
    positionX,
    reverse,
    massKg,
    grade,
    effectiveTractiveEffortN,
    brake,
    brakeCapacityN,
    dt,
  } = input;

  const travelSign = reverse ? -1 : 1;

  // Tractive effort in the intended travel direction.
  const tractiveForce = effectiveTractiveEffortN * travelSign;

  // Grade force (signed along +X).
  const gradeForce = computeGradeForce(massKg, grade);

  // Resistances oppose current motion. When essentially stopped, resistances
  // oppose the *intended* travel direction (so they don't fight starting off).
  const motionSign =
    Math.abs(speed) > STOP_EPSILON ? Math.sign(speed) : travelSign;

  const rolling = computeRollingResistance(massKg);
  const aero = computeAeroDrag(speed);
  const brakeForce = clamp01(brake) * brakeCapacityN;

  const isMoving = Math.abs(speed) > STOP_EPSILON;

  // Resistances (rolling + aero + brake) only apply while actually moving.
  const movingResistMag = isMoving ? rolling + aero + brakeForce : 0;
  const resistForce = -motionSign * movingResistMag;

  const netForceN = tractiveForce + gradeForce + resistForce;
  const accel = netForceN / massKg;

  let newSpeed = speed + accel * dt;

  // Net drive magnitude trying to keep/put the train in motion (tractive +
  // gravity along the grade). Compared against resistance to decide stalls.
  const driveMag = Math.abs(tractiveForce + gradeForce);

  if (isMoving) {
    // Snap to rest when braking/resistance overshoots through zero and there is
    // no net drive strong enough to sustain motion in the new direction.
    if (Math.sign(newSpeed) !== Math.sign(speed)) {
      if (driveMag < movingResistMag || brakeForce > 0) {
        newSpeed = 0;
      }
    }
  } else {
    // Near standstill: only start moving if the drive can overcome static
    // resistance (rolling + brake). Otherwise stay put. Braking always holds.
    const staticResist = rolling + brakeForce;
    if (brakeForce > 0 || driveMag <= staticResist) {
      newSpeed = 0;
    }
  }

  const newPosition = positionX + newSpeed * dt;

  return { speed: newSpeed, positionX: newPosition, netForceN };
}

/** Clamps a value to [0, 1]. */
function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
