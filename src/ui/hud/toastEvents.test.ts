/**
 * Unit tests for the pure toast transition detector.
 *
 * No DOM / React here — only the pure diff logic is tested (per the brief).
 */

import { describe, expect, it } from "vitest";
import type {
  GameSnapshot,
  StationProximity,
} from "../../game/simulation/types";
import { detectToastEvents } from "./toastEvents";

/** A minimal station-proximity slice. */
function station(overrides: Partial<StationProximity> = {}): StationProximity {
  return {
    stationId: "st-1",
    stationName: "Ashford",
    distanceM: 0,
    inRange: false,
    interactions: [],
    ...overrides,
  };
}

/** A minimal snapshot with only the fields the detector reads. */
function snap(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    positionX: 0,
    speed: 0,
    grade: 0,
    reverse: false,
    fuelLitres: 100,
    fuelCapacity: 200,
    temperatureC: 20,
    temperatureState: "safe",
    engineRpm: 0,
    tractionState: "gripping",
    slipRatio: 0,
    damage: 0,
    wheelDamage: 0,
    totalMassKg: 90_000,
    cargo: [],
    money: 1000,
    locomotiveId: "loco-1",
    ownedUpgradeIds: [],
    station: station(),
    fireEnabled: true,
    difficulty: "normal",
    fireFrontX: -1000,
    fireDistanceM: 1000,
    timeLimitS: 600,
    timeRemainingS: 600,
    emergencyRefuelCount: 0,
    runState: "running",
    runEndReason: "none",
    progress: 0,
    ...overrides,
  };
}

describe("detectToastEvents", () => {
  it("returns nothing on the first frame (no prev)", () => {
    expect(detectToastEvents(null, snap())).toEqual([]);
  });

  it("emits a money toast when money rises while in range", () => {
    const prev = snap({ money: 1000, station: station({ inRange: true }) });
    const cur = snap({ money: 1500, station: station({ inRange: true }) });
    expect(detectToastEvents(prev, cur)).toEqual([
      { kind: "money", amountEarned: 500 },
    ]);
  });

  it("ignores money changes while out of range", () => {
    const prev = snap({ money: 1000, station: station({ inRange: false }) });
    const cur = snap({ money: 1500, station: station({ inRange: false }) });
    expect(detectToastEvents(prev, cur)).toEqual([]);
  });

  it("ignores money spent (a decrease) in range", () => {
    const prev = snap({ money: 1500, station: station({ inRange: true }) });
    const cur = snap({ money: 1000, station: station({ inRange: true }) });
    expect(detectToastEvents(prev, cur)).toEqual([]);
  });

  it("emits a rescue toast when the emergency refuel counter increases", () => {
    const prev = snap({ emergencyRefuelCount: 0 });
    const cur = snap({ emergencyRefuelCount: 1 });
    expect(detectToastEvents(prev, cur)).toEqual([{ kind: "rescue" }]);
  });

  it("emits one upgrade toast per newly owned upgrade id", () => {
    const prev = snap({ ownedUpgradeIds: ["upgrade-radiator"] });
    const cur = snap({
      ownedUpgradeIds: ["upgrade-radiator", "upgrade-brakes"],
    });
    expect(detectToastEvents(prev, cur)).toEqual([
      { kind: "upgrade", upgradeId: "upgrade-brakes" },
    ]);
  });

  it("combines multiple simultaneous events in a stable order", () => {
    const prev = snap({
      money: 1000,
      emergencyRefuelCount: 0,
      ownedUpgradeIds: [],
      station: station({ inRange: true }),
    });
    const cur = snap({
      money: 1200,
      emergencyRefuelCount: 1,
      ownedUpgradeIds: ["upgrade-sanders"],
      station: station({ inRange: true }),
    });
    expect(detectToastEvents(prev, cur)).toEqual([
      { kind: "money", amountEarned: 200 },
      { kind: "rescue" },
      { kind: "upgrade", upgradeId: "upgrade-sanders" },
    ]);
  });
});
