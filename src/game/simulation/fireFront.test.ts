import { describe, expect, it } from "vitest";

import {
  distanceToFire,
  fireSpeedAt,
  isCaughtByFire,
  stepFire,
} from "./fireFront";
import { FIRE_BASE_SPEED } from "./constants";

const DT = 1 / 60;

describe("fire front", () => {
  it("has a base speed and ramps up over time", () => {
    expect(fireSpeedAt(0)).toBeCloseTo(FIRE_BASE_SPEED, 5);
    expect(fireSpeedAt(600)).toBeGreaterThan(fireSpeedAt(0));
  });

  it("advances forward over ticks", () => {
    let x = -600;
    let elapsed = 0;
    for (let i = 0; i < 600; i++) {
      const r = stepFire(x, elapsed, DT);
      x = r.positionX;
      elapsed = r.elapsedS;
    }
    expect(x).toBeGreaterThan(-600);
    expect(elapsed).toBeCloseTo(10, 3);
  });

  it("distance-to-fire decreases when the train is stationary", () => {
    const trainX = 500;
    let fireX = -600;
    let elapsed = 0;
    const firstDist = distanceToFire(trainX, fireX);
    for (let i = 0; i < 600; i++) {
      const r = stepFire(fireX, elapsed, DT);
      fireX = r.positionX;
      elapsed = r.elapsedS;
    }
    const laterDist = distanceToFire(trainX, fireX);
    expect(laterDist).toBeLessThan(firstDist);
  });

  it("eventually catches a stationary train", () => {
    const trainX = 500;
    let fireX = -600;
    let elapsed = 0;
    let caught = false;
    for (let i = 0; i < 60 * 300; i++) {
      const r = stepFire(fireX, elapsed, DT);
      fireX = r.positionX;
      elapsed = r.elapsedS;
      if (isCaughtByFire(trainX, fireX)) {
        caught = true;
        break;
      }
    }
    expect(caught).toBe(true);
  });
});
