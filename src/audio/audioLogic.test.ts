/**
 * Unit tests for the pure audio logic — mapping curves + snapshot transition
 * detection. These never touch an AudioContext, so they run in plain Node.
 */

import { describe, it, expect } from "vitest";
import type { GameSnapshot } from "../game/simulation/types";
import { estimateEngineLoad, loadToFrequency, loadToGain } from "./engineAudio";
import { speedToClickRate, speedToClatterGain } from "./wheelAudio";
import { isBrakingHeuristic } from "./brakeAudio";
import { slipToGain } from "./slipAudio";
import { selectAlarm } from "./warningAudio";
import { distanceToIntensity } from "./fireAmbience";
import { detectAudioEvents } from "./uiAudio";

/** Builds a minimal snapshot; override only the fields a test cares about. */
function makeSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    positionX: 0,
    speed: 0,
    grade: 0,
    reverse: false,
    fuelLitres: 2500,
    fuelCapacity: 2500,
    temperatureC: 20,
    temperatureState: "safe",
    tractionState: "gripping",
    slipRatio: 0,
    damage: 0,
    wheelDamage: 0,
    totalMassKg: 100_000,
    cargo: [],
    money: 0,
    locomotiveId: "loco-1",
    ownedUpgradeIds: [],
    station: {
      stationId: null,
      stationName: null,
      distanceM: 999,
      inRange: false,
      interactions: [],
    },
    fireFrontX: -5000,
    fireDistanceM: 5000,
    timeRemainingS: 600,
    runState: "running",
    runEndReason: "none",
    progress: 0,
    ...overrides,
  };
}

describe("engine load mapping", () => {
  it("is 0 at rest and safe temperature", () => {
    expect(estimateEngineLoad(makeSnapshot())).toBeCloseTo(0, 5);
  });

  it("rises with heat, grade and speed", () => {
    const hot = estimateEngineLoad(
      makeSnapshot({ temperatureC: 110, grade: 0.06, speed: 30 }),
    );
    expect(hot).toBeGreaterThan(0.8);
  });

  it("pins high while slipping regardless of other inputs", () => {
    const load = estimateEngineLoad(
      makeSnapshot({ tractionState: "slipping", slipRatio: 1.5 }),
    );
    expect(load).toBeGreaterThanOrEqual(0.85);
  });

  it("clamps to 0..1", () => {
    const load = estimateEngineLoad(
      makeSnapshot({ temperatureC: 999, grade: 1, speed: 999 }),
    );
    expect(load).toBeLessThanOrEqual(1);
    expect(load).toBeGreaterThanOrEqual(0);
  });

  it("frequency and gain increase monotonically with load", () => {
    expect(loadToFrequency(0)).toBeLessThan(loadToFrequency(1));
    expect(loadToGain(0)).toBeLessThan(loadToGain(1));
    // Idle is quieter than full — engine sits under the alarms.
    expect(loadToGain(0)).toBeLessThan(0.1);
  });
});

describe("wheel clatter mapping", () => {
  it("is silent below the speed threshold", () => {
    expect(speedToClatterGain(0)).toBe(0);
    expect(speedToClatterGain(1)).toBe(0);
  });

  it("click rate and gain rise with speed", () => {
    expect(speedToClickRate(5)).toBeLessThan(speedToClickRate(25));
    expect(speedToClatterGain(5)).toBeLessThan(speedToClatterGain(25));
  });

  it("clamps loudness at high speed", () => {
    expect(speedToClatterGain(200)).toBeLessThanOrEqual(0.1);
  });
});

describe("brake heuristic", () => {
  it("detects hard deceleration while moving", () => {
    expect(isBrakingHeuristic(20, 15, 1)).toBe(true);
  });

  it("ignores coasting / acceleration", () => {
    expect(isBrakingHeuristic(20, 19.9, 1)).toBe(false);
    expect(isBrakingHeuristic(10, 15, 1)).toBe(false);
  });

  it("ignores near-stop and bad dt", () => {
    expect(isBrakingHeuristic(3, 1, 1)).toBe(false);
    expect(isBrakingHeuristic(20, 10, 0)).toBe(false);
  });
});

describe("slip screech mapping", () => {
  it("is silent when gripping", () => {
    expect(slipToGain("gripping", 2)).toBe(0);
  });

  it("has an audible floor at slip onset and rises with ratio", () => {
    const onset = slipToGain("slipping", 1);
    const heavy = slipToGain("slipping", 1.6);
    expect(onset).toBeGreaterThan(0);
    expect(heavy).toBeGreaterThan(onset);
  });
});

describe("alarm selection", () => {
  it("is silent in a calm running state", () => {
    expect(selectAlarm(makeSnapshot())).toBeNull();
  });

  it("prioritises critical temperature over everything", () => {
    const alarm = selectAlarm(
      makeSnapshot({
        temperatureState: "critical",
        fuelLitres: 0,
        timeRemainingS: 5,
      }),
    );
    expect(alarm?.kind).toBe("critical");
    expect(alarm?.twoTone).toBe(true);
  });

  it("critical alarms faster than warning", () => {
    const crit = selectAlarm(makeSnapshot({ temperatureState: "critical" }));
    const warn = selectAlarm(makeSnapshot({ temperatureState: "warning" }));
    expect(crit!.interval).toBeLessThan(warn!.interval);
  });

  it("warns on low fuel and low time when temperature is safe", () => {
    expect(selectAlarm(makeSnapshot({ fuelLitres: 100 }))?.kind).toBe(
      "low-fuel",
    );
    expect(selectAlarm(makeSnapshot({ timeRemainingS: 20 }))?.kind).toBe(
      "low-time",
    );
  });

  it("is silent once the run has ended", () => {
    expect(
      selectAlarm(
        makeSnapshot({ temperatureState: "critical", runState: "failed" }),
      ),
    ).toBeNull();
  });
});

describe("fire ambience intensity", () => {
  it("is silent when far and full when close", () => {
    expect(distanceToIntensity(5000)).toBe(0);
    expect(distanceToIntensity(50)).toBe(1);
  });

  it("increases as the fire nears", () => {
    expect(distanceToIntensity(2000)).toBeLessThan(distanceToIntensity(500));
  });

  it("treats distance magnitude symmetrically", () => {
    expect(distanceToIntensity(-100)).toBe(distanceToIntensity(100));
  });
});

describe("audio event detection", () => {
  it("returns nothing on the first frame", () => {
    expect(detectAudioEvents(null, makeSnapshot())).toEqual([]);
  });

  it("detects entering a station range", () => {
    const prev = makeSnapshot();
    const cur = makeSnapshot({
      station: { ...prev.station, inRange: true, stationId: "s1" },
    });
    expect(detectAudioEvents(prev, cur)).toContain("station-entered");
  });

  it("detects accepting cargo", () => {
    const prev = makeSnapshot();
    const cur = makeSnapshot({
      cargo: [
        {
          jobId: "j1",
          wagonCount: 1,
          totalWeightKg: 1000,
          destinationStationId: "s2",
          payment: 500,
        },
      ],
    });
    expect(detectAudioEvents(prev, cur)).toContain("cargo-accepted");
  });

  it("detects money gain, repair and refuel", () => {
    const prev = makeSnapshot({
      money: 100,
      damage: 0.5,
      wheelDamage: 0.5,
      fuelLitres: 500,
    });
    const cur = makeSnapshot({
      money: 600,
      damage: 0.1,
      wheelDamage: 0.1,
      fuelLitres: 2500,
    });
    const events = detectAudioEvents(prev, cur);
    expect(events).toContain("money-gained");
    expect(events).toContain("repaired");
    expect(events).toContain("refuelled");
  });

  it("detects win and fail edges exactly once", () => {
    const running = makeSnapshot();
    const won = makeSnapshot({ runState: "won" });
    const failed = makeSnapshot({ runState: "failed" });
    expect(detectAudioEvents(running, won)).toContain("won");
    expect(detectAudioEvents(running, failed)).toContain("failed");
    // Already-won → won: no repeat.
    expect(detectAudioEvents(won, won)).not.toContain("won");
  });
});
