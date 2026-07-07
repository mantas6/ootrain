/**
 * Unit tests for the pure smoke emission curve. No Three.js/DOM — runs in
 * plain Node like the rest of the sim/logic tests.
 */

import { describe, it, expect } from "vitest";
import { rpmToSmokeDrive, smokeEmissionParams } from "./smokeParams";
import {
  ENGINE_IDLE_RPM,
  ENGINE_MAX_RPM,
} from "../../game/simulation/constants";

describe("rpmToSmokeDrive", () => {
  it("maps idle RPM to 0 and max RPM to 1", () => {
    expect(rpmToSmokeDrive(ENGINE_IDLE_RPM)).toBeCloseTo(0, 5);
    expect(rpmToSmokeDrive(ENGINE_MAX_RPM)).toBeCloseTo(1, 5);
  });

  it("clamps out-of-band RPM", () => {
    expect(rpmToSmokeDrive(ENGINE_IDLE_RPM - 500)).toBe(0);
    expect(rpmToSmokeDrive(ENGINE_MAX_RPM + 500)).toBe(1);
  });

  it("increases monotonically across the band", () => {
    const mid = (ENGINE_IDLE_RPM + ENGINE_MAX_RPM) / 2;
    expect(rpmToSmokeDrive(mid)).toBeCloseTo(0.5, 5);
  });
});

describe("smokeEmissionParams", () => {
  it("emits sparse, faint, pale smoke at idle", () => {
    const p = smokeEmissionParams(ENGINE_IDLE_RPM);
    expect(p.rate).toBeCloseTo(1.5, 5);
    expect(p.darkness).toBeCloseTo(0.1, 5);
    expect(p.opacity).toBeCloseTo(0.35, 5);
  });

  it("emits dense, dark, thick, fast smoke at full throttle", () => {
    const idle = smokeEmissionParams(ENGINE_IDLE_RPM);
    const full = smokeEmissionParams(ENGINE_MAX_RPM);
    expect(full.rate).toBeGreaterThan(idle.rate);
    expect(full.darkness).toBeGreaterThan(idle.darkness);
    expect(full.spawnScale).toBeGreaterThan(idle.spawnScale);
    expect(full.riseSpeed).toBeGreaterThan(idle.riseSpeed);
    expect(full.opacity).toBeGreaterThan(idle.opacity);
    expect(full.darkness).toBeCloseTo(1, 5);
  });

  it("every parameter rises monotonically with RPM", () => {
    const mid = (ENGINE_IDLE_RPM + ENGINE_MAX_RPM) / 2;
    const low = smokeEmissionParams(ENGINE_IDLE_RPM);
    const midP = smokeEmissionParams(mid);
    const high = smokeEmissionParams(ENGINE_MAX_RPM);
    for (const key of [
      "rate",
      "darkness",
      "spawnScale",
      "riseSpeed",
      "opacity",
    ] as const) {
      expect(midP[key]).toBeGreaterThan(low[key]);
      expect(high[key]).toBeGreaterThan(midP[key]);
    }
  });

  it("clamps below idle to the idle params", () => {
    const belowIdle = smokeEmissionParams(ENGINE_IDLE_RPM - 300);
    const idle = smokeEmissionParams(ENGINE_IDLE_RPM);
    expect(belowIdle).toEqual(idle);
  });
});
