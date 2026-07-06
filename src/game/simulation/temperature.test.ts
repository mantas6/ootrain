import { describe, expect, it } from "vitest";

import { LOCO_1 } from "../data/locomotives";
import {
  classifyTemperature,
  computeCooling,
  stepTemperature,
  TEMPERATURE_THRESHOLDS,
  thermalPowerFactor,
  type TemperatureInput,
} from "./temperature";
import {
  START_TEMP_C,
  TEMP_CRITICAL_C,
  TEMP_FAILURE_C,
  TEMP_WARNING_C,
} from "./constants";

const DT = 1 / 60;

function baseInput(over: Partial<TemperatureInput> = {}): TemperatureInput {
  return {
    tempC: START_TEMP_C,
    deliveredPowerKW: 0,
    heatGenerationFactor: LOCO_1.heatGenerationFactor,
    coolingRate: LOCO_1.coolingRate,
    speedMagAbs: 0,
    damage: 0,
    extraHeatC: 0,
    dt: DT,
    ...over,
  };
}

function run(input: TemperatureInput, n: number): number {
  let temp = input.tempC;
  for (let i = 0; i < n; i++) {
    temp = stepTemperature({ ...input, tempC: temp }).tempC;
  }
  return temp;
}

describe("temperature thresholds", () => {
  it("classifies threshold bands", () => {
    expect(classifyTemperature(50)).toBe("safe");
    expect(classifyTemperature(TEMP_WARNING_C + 1)).toBe("warning");
    expect(classifyTemperature(TEMP_CRITICAL_C + 1)).toBe("critical");
    expect(classifyTemperature(TEMP_FAILURE_C + 1)).toBe("failure");
  });

  it("exports thresholds in ascending order", () => {
    expect(TEMPERATURE_THRESHOLDS.warning).toBeLessThan(
      TEMPERATURE_THRESHOLDS.critical,
    );
    expect(TEMPERATURE_THRESHOLDS.critical).toBeLessThan(
      TEMPERATURE_THRESHOLDS.failure,
    );
  });

  it("power factor drops in critical and is zero at failure", () => {
    expect(thermalPowerFactor("safe")).toBe(1);
    expect(thermalPowerFactor("warning")).toBe(1);
    expect(thermalPowerFactor("critical")).toBeLessThan(1);
    expect(thermalPowerFactor("failure")).toBe(0);
  });
});

describe("temperature dynamics", () => {
  it("rises under high power (heavy load uphill scenario)", () => {
    const start = 60;
    const after = run(
      baseInput({ tempC: start, deliveredPowerKW: 1_500 }),
      600,
    );
    expect(after).toBeGreaterThan(start);
  });

  it("cools when idle at low throttle", () => {
    const start = 110;
    const after = run(baseInput({ tempC: start, deliveredPowerKW: 0 }), 600);
    expect(after).toBeLessThan(start);
  });

  it("cools faster with airflow (speed) than at a standstill", () => {
    const start = 110;
    const still = run(
      baseInput({ tempC: start, deliveredPowerKW: 0, speedMagAbs: 0 }),
      300,
    );
    const moving = run(
      baseInput({ tempC: start, deliveredPowerKW: 0, speedMagAbs: 20 }),
      300,
    );
    expect(moving).toBeLessThan(still);
    expect(computeCooling(start, LOCO_1.coolingRate, 20)).toBeGreaterThan(
      computeCooling(start, LOCO_1.coolingRate, 0),
    );
  });

  it("transitions through warning into critical under sustained load", () => {
    let temp = 90;
    let sawWarning = false;
    let sawCritical = false;
    for (let i = 0; i < 3000; i++) {
      const r = stepTemperature(
        baseInput({ tempC: temp, deliveredPowerKW: 1_600 }),
      );
      temp = r.tempC;
      if (r.state === "warning") sawWarning = true;
      if (r.state === "critical") sawCritical = true;
      if (r.state === "failure") break;
    }
    expect(sawWarning).toBe(true);
    expect(sawCritical).toBe(true);
  });

  it("damage worsens heat generation", () => {
    const clean = stepTemperature(
      baseInput({ tempC: 80, deliveredPowerKW: 1_000, damage: 0 }),
    ).tempC;
    const damaged = stepTemperature(
      baseInput({ tempC: 80, deliveredPowerKW: 1_000, damage: 1 }),
    ).tempC;
    expect(damaged).toBeGreaterThan(clean);
  });
});
