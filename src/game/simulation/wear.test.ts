import { describe, expect, it } from "vitest";

import { LOCO_1 } from "../data/locomotives";
import {
  applyDamage,
  computeDamageAccrual,
  damagePowerFactor,
  repair,
  repairCost,
} from "./wear";

describe("damage accrual", () => {
  it("accrues damage in the critical temperature band", () => {
    const d = computeDamageAccrual({
      temperatureState: "critical",
      brake: 0,
      speedMagAbs: 0,
      totalMassKg: LOCO_1.mass,
      locoMassKg: LOCO_1.mass,
      dt: 1,
    });
    expect(d).toBeGreaterThan(0);
  });

  it("accrues no overheat damage when safe", () => {
    const d = computeDamageAccrual({
      temperatureState: "safe",
      brake: 0,
      speedMagAbs: 0,
      totalMassKg: LOCO_1.mass,
      locoMassKg: LOCO_1.mass,
      dt: 1,
    });
    expect(d).toBe(0);
  });

  it("accrues damage from harsh braking at speed", () => {
    const d = computeDamageAccrual({
      temperatureState: "safe",
      brake: 1,
      speedMagAbs: 20,
      totalMassKg: LOCO_1.mass,
      locoMassKg: LOCO_1.mass,
      dt: 1,
    });
    expect(d).toBeGreaterThan(0);
  });

  it("accrues damage from overloading", () => {
    const d = computeDamageAccrual({
      temperatureState: "safe",
      brake: 0,
      speedMagAbs: 5,
      totalMassKg: LOCO_1.mass * 6,
      locoMassKg: LOCO_1.mass,
      dt: 1,
    });
    expect(d).toBeGreaterThan(0);
  });
});

describe("damage effects", () => {
  it("clamps damage to [0,1]", () => {
    expect(applyDamage(0.9, 0.5)).toBe(1);
    expect(applyDamage(0.2, -0.5)).toBe(0);
  });

  it("damage caps power", () => {
    expect(damagePowerFactor(0)).toBe(1);
    expect(damagePowerFactor(1)).toBeLessThan(1);
  });
});

describe("repair", () => {
  it("fully repairs when affordable and deducts money", () => {
    const cost = repairCost(0.4);
    const r = repair(0.3, 0.1, cost + 100);
    expect(r.damage).toBe(0);
    expect(r.wheelDamage).toBe(0);
    expect(r.money).toBe(100);
    expect(r.repaired).toBe(true);
  });

  it("partially repairs when money is short", () => {
    const cost = repairCost(0.4);
    const r = repair(0.3, 0.1, cost / 2);
    expect(r.damage).toBeGreaterThan(0);
    expect(r.damage).toBeLessThan(0.3);
    expect(r.money).toBe(0);
  });

  it("no-op with no damage", () => {
    const r = repair(0, 0, 1_000);
    expect(r.repaired).toBe(false);
    expect(r.money).toBe(1_000);
  });
});
