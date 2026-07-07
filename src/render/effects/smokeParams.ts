/**
 * Pure mapping from engine state to exhaust-smoke emission parameters.
 *
 * The smoke is driven by the engine's **RPM** (read from the snapshot's
 * `engineRpm`, which smoothly spools toward the throttle target and is
 * fuel-gated — a dry tank drops RPM to idle, so RPM is the truthful signal for
 * "how hard is the engine working right now"). RPM normalises to 0..1 across
 * the idle→max band ({@link rpmToSmokeDrive}) and maps to emission rate, colour
 * darkness, puff size, rise speed, and opacity via a single pure curve
 * ({@link smokeEmissionParams}).
 *
 * Keeping this pure and free of Three.js/DOM makes it cheap to unit test in
 * plain Node; the {@link import("./Smoke").Smoke} render class just consumes
 * the params.
 */

import {
  ENGINE_IDLE_RPM,
  ENGINE_MAX_RPM,
} from "../../game/simulation/constants";

/** Emission parameters for the smoke system at a given engine drive. */
export interface SmokeEmissionParams {
  /** Puffs spawned per second. Sparse at idle, dense under load. */
  rate: number;
  /** Colour lerp factor: 0 = pale idle grey, 1 = near-black heavy smoke. */
  darkness: number;
  /** Base puff scale at spawn (world units). Bigger under load. */
  spawnScale: number;
  /** Initial upward rise speed, m/s. Faster under load. */
  riseSpeed: number;
  /** Peak opacity multiplier: faint at idle, thick under load. */
  opacity: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Normalises an RPM value to a 0..1 "drive" across the idle→max band (pure,
 * testable). Idle RPM maps to 0, max RPM to 1; out-of-band values are clamped.
 */
export function rpmToSmokeDrive(rpm: number): number {
  return clamp01((rpm - ENGINE_IDLE_RPM) / (ENGINE_MAX_RPM - ENGINE_IDLE_RPM));
}

/**
 * Maps engine RPM to smoke emission parameters (pure, testable). Every output
 * rises monotonically with RPM so low throttle reads as sparse/faint/pale
 * smoke and full throttle as dense/dark/fast smoke.
 */
export function smokeEmissionParams(engineRpm: number): SmokeEmissionParams {
  const drive = rpmToSmokeDrive(engineRpm);
  return {
    rate: 1.5 + drive * 22,
    darkness: 0.1 + drive * 0.9,
    spawnScale: 0.55 + drive * 0.55,
    riseSpeed: 1.6 + drive * 2.2,
    opacity: 0.35 + drive * 0.5,
  };
}
