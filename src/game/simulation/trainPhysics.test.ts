import { describe, expect, it } from "vitest";

import { LOCO_1 } from "../data/locomotives";
import {
  computeAeroDrag,
  computeBrakeCapacity,
  computeDemandedTractiveEffort,
  computeGradeForce,
  computeRollingResistance,
  stepPhysics,
  type PhysicsStepInput,
} from "./trainPhysics";
import { GRAVITY } from "./constants";

const DT = 1 / 60;

function baseInput(over: Partial<PhysicsStepInput> = {}): PhysicsStepInput {
  return {
    speed: 0,
    positionX: 0,
    reverse: false,
    massKg: LOCO_1.mass,
    grade: 0,
    effectiveTractiveEffortN: 0,
    brake: 0,
    brakeCapacityN: computeBrakeCapacity(0),
    dt: DT,
    ...over,
  };
}

/** Runs n physics ticks with constant inputs, returning the final state. */
function run(input: PhysicsStepInput, n: number): PhysicsStepInput {
  let cur = input;
  for (let i = 0; i < n; i++) {
    const r = stepPhysics(cur);
    cur = { ...cur, speed: r.speed, positionX: r.positionX };
  }
  return cur;
}

describe("trainPhysics force helpers", () => {
  it("rolling resistance is coeff * mass * g", () => {
    const r = computeRollingResistance(LOCO_1.mass);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeCloseTo(0.002 * LOCO_1.mass * GRAVITY, 5);
  });

  it("aero drag grows with the square of speed", () => {
    expect(computeAeroDrag(20)).toBeCloseTo(4 * computeAeroDrag(10), 5);
  });

  it("grade force retards forward travel uphill", () => {
    expect(computeGradeForce(LOCO_1.mass, 0.05)).toBeLessThan(0);
    expect(computeGradeForce(LOCO_1.mass, -0.05)).toBeGreaterThan(0);
  });

  it("demanded tractive effort is capped by the effort limit at low speed", () => {
    const cap = { maxPowerW: 1_100_000, maxTractiveEffortN: 240_000 };
    const effort = computeDemandedTractiveEffort(1, 0, cap);
    expect(effort).toBeCloseTo(240_000, 0);
  });

  it("demanded tractive effort is power-limited at high speed", () => {
    const cap = { maxPowerW: 1_100_000, maxTractiveEffortN: 240_000 };
    const effort = computeDemandedTractiveEffort(1, 30, cap);
    expect(effort).toBeCloseTo(1_100_000 / 30, 0);
    expect(effort).toBeLessThan(240_000);
  });
});

describe("trainPhysics integration", () => {
  it("accelerates under full throttle on flat ground", () => {
    const input = baseInput({ effectiveTractiveEffortN: 200_000 });
    const after = run(input, 120); // 2 seconds
    expect(after.speed).toBeGreaterThan(1);
    expect(after.positionX).toBeGreaterThan(0);
  });

  it("brakes bring a moving train to a stop", () => {
    const input = baseInput({
      speed: 15,
      effectiveTractiveEffortN: 0,
      brake: 1,
    });
    const after = run(input, 600); // up to 10 seconds
    expect(after.speed).toBe(0);
  });

  it("full brake stops promptly from cruise (buffed brake force)", () => {
    // Balance guard for the brake buff (BASE_BRAKE_FORCE_N): stopping distance
    // from a cruise speed must be a few hundred metres at most, not kilometres.
    // Distance travelled from a given speed under full brake until at rest.
    function stopDistance(startSpeed: number, massKg: number): number {
      let cur = baseInput({
        speed: startSpeed,
        massKg,
        effectiveTractiveEffortN: 0,
        brake: 1,
      });
      for (let i = 0; i < 6000; i++) {
        const r = stepPhysics(cur);
        cur = { ...cur, speed: r.speed, positionX: r.positionX };
        if (cur.speed === 0) break;
      }
      return cur.positionX;
    }

    // Bare loco from 20 m/s: prompt (~50 m with the 360 kN buff; was ~98 m).
    expect(stopDistance(20, LOCO_1.mass)).toBeLessThan(70);
    // A ~4× overloaded consist from 20 m/s still stops within a few hundred m.
    expect(stopDistance(20, LOCO_1.mass * 4)).toBeLessThan(300);
    // Even from a ~50 m/s cruise the bare loco halts in a few hundred metres.
    expect(stopDistance(50, LOCO_1.mass)).toBeLessThan(400);
  });

  it("uphill slows acceleration versus flat", () => {
    const flat = run(baseInput({ effectiveTractiveEffortN: 150_000 }), 180);
    const uphill = run(
      baseInput({ effectiveTractiveEffortN: 150_000, grade: 0.05 }),
      180,
    );
    expect(uphill.speed).toBeLessThan(flat.speed);
  });

  it("a steep enough grade stalls the train", () => {
    // Effort just above rolling resistance but well below grade pull.
    const input = baseInput({
      effectiveTractiveEffortN: 20_000,
      grade: 0.07,
      speed: 2,
    });
    const after = run(input, 300);
    expect(after.speed).toBeLessThanOrEqual(2);
  });

  it("heavier mass accelerates slower under the same effort", () => {
    const light = run(baseInput({ effectiveTractiveEffortN: 200_000 }), 180);
    const heavy = run(
      baseInput({
        effectiveTractiveEffortN: 200_000,
        massKg: LOCO_1.mass + 120_000,
      }),
      180,
    );
    expect(heavy.speed).toBeLessThan(light.speed);
  });

  it("reverse moves the train backward", () => {
    const input = baseInput({
      reverse: true,
      effectiveTractiveEffortN: 150_000,
    });
    const after = run(input, 120);
    expect(after.speed).toBeLessThan(0);
    expect(after.positionX).toBeLessThan(0);
  });
});
