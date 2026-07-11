import { describe, expect, it } from "vitest";

import { stepEmergencyFuel } from "./emergencyFuel";
import { EMERGENCY_REFUEL_DELAY_S } from "./constants";

const DT = 1 / 60;

describe("stepEmergencyFuel timer", () => {
  it("stays reset while fuelled or moving", () => {
    expect(
      stepEmergencyFuel({
        outOfFuel: false,
        stationary: true,
        canSelfRescue: false,
        strandedS: 3,
        dt: DT,
      }),
    ).toEqual({ strandedS: 0, triggered: false });

    expect(
      stepEmergencyFuel({
        outOfFuel: true,
        stationary: false,
        canSelfRescue: false,
        strandedS: 3,
        dt: DT,
      }),
    ).toEqual({ strandedS: 0, triggered: false });
  });

  it("resets when the player could self-rescue at a station", () => {
    expect(
      stepEmergencyFuel({
        outOfFuel: true,
        stationary: true,
        canSelfRescue: true,
        strandedS: 5,
        dt: DT,
      }),
    ).toEqual({ strandedS: 0, triggered: false });
  });

  it("accumulates while genuinely stranded then triggers once", () => {
    let strandedS = 0;
    let triggered = false;
    let seconds = 0;
    for (let i = 0; i < 60 * 30; i++) {
      const r = stepEmergencyFuel({
        outOfFuel: true,
        stationary: true,
        canSelfRescue: false,
        strandedS,
        dt: DT,
      });
      strandedS = r.strandedS;
      seconds = (i + 1) * DT;
      if (r.triggered) {
        triggered = true;
        break;
      }
    }
    expect(triggered).toBe(true);
    // Fires at (just past) the configured delay, and resets the timer.
    expect(seconds).toBeGreaterThanOrEqual(EMERGENCY_REFUEL_DELAY_S);
    expect(seconds).toBeLessThan(EMERGENCY_REFUEL_DELAY_S + 1);
    expect(strandedS).toBe(0);
  });
});
