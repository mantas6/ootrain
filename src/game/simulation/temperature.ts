/**
 * Engine temperature model.
 *
 * Temperature rises from delivered engine power (heat generation factor scaled
 * by power) plus wasted slip power (added by the caller), and worsens with
 * accumulated damage. It falls via passive cooling that scales with airflow
 * (speed): at a standstill only a fraction of the loco's cooling capacity is
 * available, so working hard at low speed under heavy load overheats fastest
 * (the "low speed poor cooling" penalty from TODO.md).
 *
 * Threshold states (constants in constants.ts):
 *   - safe:     below warning
 *   - warning:  warning <= T < critical  (usable, alarm)
 *   - critical: critical <= T < failure  (power reduced, wear accelerates)
 *   - failure:  T >= failure             (engine breaks, run fails)
 */

import {
  AMBIENT_TEMP_C,
  COOLING_FULL_AIRFLOW_SPEED,
  COOLING_IDLE_FRACTION,
  COOLING_REFERENCE_DELTA_C,
  CRITICAL_POWER_FACTOR,
  DAMAGE_HEAT_PENALTY,
  TEMP_CRITICAL_C,
  TEMP_FAILURE_C,
  TEMP_WARNING_C,
} from "./constants";
import type { TemperatureState } from "./types";

/** Re-export thresholds so consumers/tests can import them from one place. */
export const TEMPERATURE_THRESHOLDS = {
  warning: TEMP_WARNING_C,
  critical: TEMP_CRITICAL_C,
  failure: TEMP_FAILURE_C,
} as const;

/** Inputs describing thermal behaviour for a step. */
export interface TemperatureInput {
  /** Current temperature, °C. */
  tempC: number;
  /** Delivered engine power this tick, kilowatts. */
  deliveredPowerKW: number;
  /** Base heat generation factor, °C/(kW·s). */
  heatGenerationFactor: number;
  /** Base passive cooling rate, °C/s at the reference over-temperature. */
  coolingRate: number;
  /** Absolute speed, m/s (drives airflow cooling). */
  speedMagAbs: number;
  /** Accumulated engine damage, 0..1 (worsens heat generation). */
  damage: number;
  /** Extra heat from slip / other sources this tick, °C. */
  extraHeatC: number;
  /** Tick duration, seconds. */
  dt: number;
}

/** Classifies a temperature into its threshold state. */
export function classifyTemperature(tempC: number): TemperatureState {
  if (tempC >= TEMP_FAILURE_C) return "failure";
  if (tempC >= TEMP_CRITICAL_C) return "critical";
  if (tempC >= TEMP_WARNING_C) return "warning";
  return "safe";
}

/**
 * Cooling capacity (°C/s) at the current over-temperature and airflow.
 * Scales with (deltaOverAmbient / reference) and with airflow, where airflow
 * ranges from COOLING_IDLE_FRACTION at rest to 1.0 at full-airflow speed.
 */
export function computeCooling(
  tempC: number,
  coolingRate: number,
  speedMagAbs: number,
): number {
  const overTemp = Math.max(0, tempC - AMBIENT_TEMP_C);
  const tempFactor = overTemp / COOLING_REFERENCE_DELTA_C;
  const airflow =
    COOLING_IDLE_FRACTION +
    (1 - COOLING_IDLE_FRACTION) *
      Math.min(1, speedMagAbs / COOLING_FULL_AIRFLOW_SPEED);
  return coolingRate * tempFactor * airflow;
}

/** Result of a temperature step. */
export interface TemperatureStepResult {
  /** New temperature, °C. */
  tempC: number;
  /** Threshold state at the new temperature. */
  state: TemperatureState;
}

/**
 * Integrates one temperature step.
 *
 * Heat in = deliveredPower * heatFactor * (1 + damagePenalty*damage) * dt
 *           + extraHeat.
 * Heat out = cooling(temp, airflow) * dt.
 */
export function stepTemperature(
  input: TemperatureInput,
): TemperatureStepResult {
  const damageMultiplier = 1 + DAMAGE_HEAT_PENALTY * input.damage;
  const heatIn =
    input.deliveredPowerKW *
      input.heatGenerationFactor *
      damageMultiplier *
      input.dt +
    input.extraHeatC;

  const cooling = computeCooling(
    input.tempC,
    input.coolingRate,
    input.speedMagAbs,
  );
  const heatOut = cooling * input.dt;

  let newTemp = input.tempC + heatIn - heatOut;
  if (newTemp < AMBIENT_TEMP_C) {
    newTemp = AMBIENT_TEMP_C;
  }

  return { tempC: newTemp, state: classifyTemperature(newTemp) };
}

/**
 * Available-power multiplier from the thermal state. Critical overheating
 * throttles the engine back; failure delivers no power.
 */
export function thermalPowerFactor(state: TemperatureState): number {
  switch (state) {
    case "safe":
    case "warning":
      return 1;
    case "critical":
      return CRITICAL_POWER_FACTOR;
    case "failure":
      return 0;
  }
}
