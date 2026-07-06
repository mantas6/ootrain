import { describe, expect, it } from "vitest";

import { LOCO_1 } from "../data/locomotives";
import { burnFuel, computeFuelBurn, isEmpty, refuel } from "./fuel";
import { REFUEL_COST_PER_L } from "./constants";

describe("fuel burn", () => {
  it("burns more with higher delivered power", () => {
    const low = computeFuelBurn(200, LOCO_1.fuelBurnRate, 1);
    const high = computeFuelBurn(1_500, LOCO_1.fuelBurnRate, 1);
    expect(high).toBeGreaterThan(low);
  });

  it("still burns idle fuel at zero power", () => {
    expect(computeFuelBurn(0, LOCO_1.fuelBurnRate, 1)).toBeGreaterThan(0);
  });

  it("burnFuel clamps at empty", () => {
    expect(burnFuel(5, 10)).toBe(0);
    expect(isEmpty(burnFuel(5, 10))).toBe(true);
  });

  it("reports empty tanks", () => {
    expect(isEmpty(0)).toBe(true);
    expect(isEmpty(1)).toBe(false);
  });
});

describe("refuel", () => {
  it("fills the tank and deducts money when affordable", () => {
    const capacity = 100;
    const r = refuel(20, capacity, 10_000);
    expect(r.litres).toBe(capacity);
    expect(r.refuelled).toBe(true);
    expect(r.money).toBeCloseTo(10_000 - 80 * REFUEL_COST_PER_L, 5);
  });

  it("partial refuel when money is short", () => {
    const r = refuel(0, 100, 10 * REFUEL_COST_PER_L);
    expect(r.litres).toBeCloseTo(10, 5);
    expect(r.money).toBe(0);
  });

  it("no-op when tank is already full", () => {
    const r = refuel(100, 100, 1_000);
    expect(r.refuelled).toBe(false);
    expect(r.money).toBe(1_000);
  });
});
