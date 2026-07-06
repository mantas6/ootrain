import { describe, expect, it } from "vitest";

import { LOCO_1 } from "../data/locomotives";
import {
  computeAvailableGrip,
  evaluateTraction,
  slipWasteHeat,
  slipWheelDamage,
} from "./traction";

describe("traction grip", () => {
  it("grip grows with the traction bonus (sanders)", () => {
    const base = computeAvailableGrip(LOCO_1.mass, 0);
    const sanded = computeAvailableGrip(LOCO_1.mass, 0.18);
    expect(sanded).toBeGreaterThan(base);
  });
});

describe("wheel slip onset", () => {
  it("grips when demanded effort is within available grip", () => {
    const grip = computeAvailableGrip(LOCO_1.mass, 0);
    const r = evaluateTraction({
      locoMassKg: LOCO_1.mass,
      tractionBonus: 0,
      demandedEffortN: grip * 0.8,
    });
    expect(r.state).toBe("gripping");
    expect(r.effectiveEffortN).toBeCloseTo(grip * 0.8, 3);
    expect(r.slipRatio).toBeLessThan(1);
  });

  it("slips when demanded effort exceeds grip (steep + heavy + full throttle)", () => {
    const grip = computeAvailableGrip(LOCO_1.mass, 0);
    const r = evaluateTraction({
      locoMassKg: LOCO_1.mass,
      tractionBonus: 0,
      demandedEffortN: grip * 1.5,
    });
    expect(r.state).toBe("slipping");
    expect(r.effectiveEffortN).toBeCloseTo(grip, 3); // capped at grip
    expect(r.slipRatio).toBeGreaterThan(1);
    expect(r.wastedEffortN).toBeGreaterThan(0);
  });

  it("lower demanded effort (reduced throttle) recovers grip", () => {
    const grip = computeAvailableGrip(LOCO_1.mass, 0);
    const slipping = evaluateTraction({
      locoMassKg: LOCO_1.mass,
      tractionBonus: 0,
      demandedEffortN: grip * 1.5,
    });
    const reduced = evaluateTraction({
      locoMassKg: LOCO_1.mass,
      tractionBonus: 0,
      demandedEffortN: grip * 0.7,
    });
    expect(slipping.state).toBe("slipping");
    expect(reduced.state).toBe("gripping");
    expect(reduced.slipRatio).toBeLessThan(slipping.slipRatio);
  });

  it("sanders reduce slip for the same demanded effort", () => {
    const grip = computeAvailableGrip(LOCO_1.mass, 0);
    const demand = grip * 1.1;
    const noSanders = evaluateTraction({
      locoMassKg: LOCO_1.mass,
      tractionBonus: 0,
      demandedEffortN: demand,
    });
    const withSanders = evaluateTraction({
      locoMassKg: LOCO_1.mass,
      tractionBonus: 0.18,
      demandedEffortN: demand,
    });
    expect(noSanders.state).toBe("slipping");
    expect(withSanders.state).toBe("gripping");
  });
});

describe("slip consequences", () => {
  it("slip generates extra heat proportional to wasted effort", () => {
    const heatSmall = slipWasteHeat(10_000, 5, 1);
    const heatBig = slipWasteHeat(50_000, 5, 1);
    expect(heatSmall).toBeGreaterThan(0);
    expect(heatBig).toBeGreaterThan(heatSmall);
  });

  it("slip accrues wheel damage over time; gripping does not", () => {
    expect(slipWheelDamage("slipping", 1)).toBeGreaterThan(0);
    expect(slipWheelDamage("gripping", 1)).toBe(0);
  });
});
