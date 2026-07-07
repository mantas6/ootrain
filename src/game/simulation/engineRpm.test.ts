import { describe, expect, it } from "vitest";

import { stepEngineRpm, targetRpm } from "./engineRpm";
import { ENGINE_IDLE_RPM, ENGINE_MAX_RPM } from "./constants";

const DT = 1 / 60;

describe("targetRpm", () => {
  it("is idle at zero throttle and max at full throttle", () => {
    expect(targetRpm(0)).toBe(ENGINE_IDLE_RPM);
    expect(targetRpm(1)).toBe(ENGINE_MAX_RPM);
  });

  it("interpolates linearly and clamps out-of-range throttle", () => {
    expect(targetRpm(0.5)).toBeCloseTo(
      (ENGINE_IDLE_RPM + ENGINE_MAX_RPM) / 2,
      5,
    );
    expect(targetRpm(-1)).toBe(ENGINE_IDLE_RPM);
    expect(targetRpm(2)).toBe(ENGINE_MAX_RPM);
  });
});

describe("stepEngineRpm", () => {
  it("rises toward the target when the throttle opens", () => {
    let rpm = ENGINE_IDLE_RPM;
    const next = stepEngineRpm(rpm, 1, DT);
    // Moves up, but does not reach the target in a single tick (lag).
    expect(next).toBeGreaterThan(rpm);
    expect(next).toBeLessThan(ENGINE_MAX_RPM);
    rpm = next;
    // Converges close to the target after enough time.
    for (let i = 0; i < 600; i++) rpm = stepEngineRpm(rpm, 1, DT);
    expect(rpm).toBeCloseTo(ENGINE_MAX_RPM, 1);
  });

  it("falls back to idle when the throttle closes", () => {
    let rpm = ENGINE_MAX_RPM;
    const next = stepEngineRpm(rpm, 0, DT);
    expect(next).toBeLessThan(rpm);
    expect(next).toBeGreaterThan(ENGINE_IDLE_RPM);
    rpm = next;
    for (let i = 0; i < 600; i++) rpm = stepEngineRpm(rpm, 0, DT);
    expect(rpm).toBeCloseTo(ENGINE_IDLE_RPM, 1);
  });

  it("holds steady once it reaches the target", () => {
    const rpm = stepEngineRpm(ENGINE_MAX_RPM, 1, DT);
    expect(rpm).toBeCloseTo(ENGINE_MAX_RPM, 5);
  });

  it("is a no-op for non-positive dt", () => {
    expect(stepEngineRpm(1234, 1, 0)).toBe(1234);
    expect(stepEngineRpm(1234, 1, -0.5)).toBe(1234);
  });

  it("is frame-rate independent over equal elapsed time", () => {
    let coarse = ENGINE_IDLE_RPM;
    coarse = stepEngineRpm(coarse, 1, 0.1);

    let fine = ENGINE_IDLE_RPM;
    for (let i = 0; i < 6; i++) fine = stepEngineRpm(fine, 1, 0.1 / 6);

    expect(fine).toBeCloseTo(coarse, 2);
  });
});
