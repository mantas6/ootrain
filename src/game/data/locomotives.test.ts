import { describe, expect, it } from "vitest";

import { LOCOMOTIVES, LOCO_1, LOCO_2, getLocomotiveById } from "./locomotives";

describe("locomotive data integrity", () => {
  it("defines exactly two locomotives with unique ids", () => {
    expect(LOCOMOTIVES.length).toBe(2);
    const ids = LOCOMOTIVES.map((l) => l.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("resolves locomotives by id", () => {
    expect(getLocomotiveById("loco-1")).toBe(LOCO_1);
    expect(getLocomotiveById("loco-2")).toBe(LOCO_2);
    expect(getLocomotiveById("nope")).toBeUndefined();
  });

  it("loco-2 has strictly more power and tractive effort than loco-1", () => {
    expect(LOCO_2.maxPowerKW).toBeGreaterThan(LOCO_1.maxPowerKW);
    expect(LOCO_2.maxTractiveEffortN).toBeGreaterThan(
      LOCO_1.maxTractiveEffortN,
    );
  });

  it("loco-2 burns more fuel per unit work than loco-1", () => {
    expect(LOCO_2.fuelBurnRate).toBeGreaterThan(LOCO_1.fuelBurnRate);
  });

  it("loco-2 cools better and generates less heat under load", () => {
    expect(LOCO_2.coolingRate).toBeGreaterThan(LOCO_1.coolingRate);
    expect(LOCO_2.heatGenerationFactor).toBeLessThan(
      LOCO_1.heatGenerationFactor,
    );
  });

  it("the starter is free and the upgrade costs money", () => {
    expect(LOCO_1.price).toBe(0);
    expect(LOCO_2.price).toBeGreaterThan(0);
  });

  it("all stats are positive and physically plausible", () => {
    for (const loco of LOCOMOTIVES) {
      expect(loco.mass).toBeGreaterThan(0);
      expect(loco.maxPowerKW).toBeGreaterThan(0);
      expect(loco.maxTractiveEffortN).toBeGreaterThan(0);
      expect(loco.fuelCapacity).toBeGreaterThan(0);
      expect(loco.fuelBurnRate).toBeGreaterThan(0);
      expect(loco.coolingRate).toBeGreaterThan(0);
      expect(loco.heatGenerationFactor).toBeGreaterThan(0);
      expect(loco.price).toBeGreaterThanOrEqual(0);
    }
  });
});
