import { describe, expect, it } from "vitest";

import { createGameSimulation } from "./Game";
import {
  DIFFICULTY_MODIFIERS,
  EMERGENCY_REFUEL_FRACTION,
  EMERGENCY_REFUEL_PENALTY,
  RUN_TIME_LIMIT_S,
  STARTING_MONEY,
  TEMP_FAILURE_C,
} from "./simulation/constants";
import { saveGame, loadGame, type SaveStorage } from "./save/localStorageSave";

const DT = 1 / 60;

/** A fake in-memory storage implementing the injectable interface. */
function fakeStorage(): SaveStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe("difficulty scaling", () => {
  it("defaults the sim to hard (raw constants) when unspecified", () => {
    const s = createGameSimulation({ seed: 1 }).getSnapshot();
    expect(s.difficulty).toBe("hard");
    expect(s.timeLimitS).toBe(RUN_TIME_LIMIT_S);
    expect(s.money).toBe(STARTING_MONEY);
  });

  it("scales the run time limit per difficulty", () => {
    const easy = createGameSimulation({ difficulty: "easy" }).getSnapshot();
    const normal = createGameSimulation({ difficulty: "normal" }).getSnapshot();
    const hard = createGameSimulation({ difficulty: "hard" }).getSnapshot();

    expect(hard.timeLimitS).toBe(RUN_TIME_LIMIT_S);
    expect(normal.timeLimitS).toBeGreaterThan(hard.timeLimitS);
    expect(easy.timeLimitS).toBeGreaterThan(normal.timeLimitS);
    expect(easy.timeLimitS).toBe(
      Math.round(
        RUN_TIME_LIMIT_S * DIFFICULTY_MODIFIERS.easy.timeLimitMultiplier,
      ),
    );
    // The remaining clock starts at the (scaled) limit.
    expect(easy.timeRemainingS).toBe(easy.timeLimitS);
  });

  it("scales starting money per difficulty", () => {
    const easy = createGameSimulation({ difficulty: "easy" }).getSnapshot();
    const normal = createGameSimulation({ difficulty: "normal" }).getSnapshot();
    const hard = createGameSimulation({ difficulty: "hard" }).getSnapshot();
    expect(easy.money).toBeGreaterThan(normal.money);
    expect(normal.money).toBeGreaterThan(hard.money);
  });

  it("an explicit startingMoney override wins over the difficulty scaling", () => {
    const s = createGameSimulation({
      difficulty: "easy",
      startingMoney: 500,
    }).getSnapshot();
    expect(s.money).toBe(500);
  });

  it("makes the fire advance slower on easier difficulties", () => {
    function fireXAfter(difficulty: "easy" | "hard"): number {
      const sim = createGameSimulation({ seed: 1, difficulty });
      for (let i = 0; i < 300; i++) sim.tick(DT);
      return sim.getSnapshot().fireFrontX;
    }
    // Both start at the same FIRE_START_X; hard advances further downrange.
    expect(fireXAfter("hard")).toBeGreaterThan(fireXAfter("easy"));
  });

  it("burns less fuel on easier difficulties for the same driving", () => {
    function fuelAfter(difficulty: "easy" | "hard"): number {
      const sim = createGameSimulation({
        seed: 1,
        difficulty,
        fireEnabled: false,
      });
      const st = sim.getState();
      st.physics.positionX = 1200; // flat section, away from stations
      sim.applyAction({ throttle: 1 });
      for (let i = 0; i < 600; i++) sim.tick(DT);
      return sim.getSnapshot().fuelLitres;
    }
    // Thriftier burn leaves more fuel in the tank.
    expect(fuelAfter("easy")).toBeGreaterThan(fuelAfter("hard"));
  });

  it("widens the temperature failure window on easier difficulties", () => {
    // A temperature that is failure-hot on hard sits below failure on easy
    // thanks to the difficulty threshold offset.
    const tempC = TEMP_FAILURE_C + 5;

    const hard = createGameSimulation({ difficulty: "hard" });
    hard.getState().thermal.tempC = tempC;
    expect(hard.getSnapshot().temperatureState).toBe("failure");

    const easy = createGameSimulation({ difficulty: "easy" });
    easy.getState().thermal.tempC = tempC;
    expect(easy.getSnapshot().temperatureState).not.toBe("failure");
  });
});

describe("maxTempBonus upgrade (upgrade-heat-resistant)", () => {
  /** Runs a runaway-overheat scenario; returns ticks-to-fail and temp at fail. */
  function runawayToFailure(ownHeatResistant: boolean): {
    ticks: number;
    tempC: number;
  } {
    const sim = createGameSimulation({ seed: 1, difficulty: "hard" });
    const st = sim.getState();
    if (ownHeatResistant) st.ownedUpgradeIds.push("upgrade-heat-resistant");
    st.thermal.tempC = 125;
    st.wear.damage = 0.6;
    st.physics.positionX = 6000;
    st.physics.speed = 0;
    st.fire.positionX = -90_000; // keep the fire away so temp fails first
    st.cargo.push({
      jobId: "heavy",
      wagonCount: 4,
      totalWeightKg: 120_000,
      destinationStationId: "finish",
      payment: 0,
    });
    for (let i = 0; i < 30 * 300; i++) {
      sim.applyAction({ throttle: 1, brake: 1 });
      sim.tick(DT);
      const s = sim.getSnapshot();
      if (s.runState === "failed") {
        return { ticks: i + 1, tempC: s.temperatureC };
      }
    }
    return {
      ticks: Number.POSITIVE_INFINITY,
      tempC: sim.getSnapshot().temperatureC,
    };
  }

  it("classification shifts the failure threshold up by the bonus", () => {
    // 140 °C is failure without the upgrade (threshold 135) but not with it
    // (+25 °C → threshold 160).
    const base = createGameSimulation({ difficulty: "hard" });
    base.getState().thermal.tempC = 140;
    expect(base.getSnapshot().temperatureState).toBe("failure");

    const upgraded = createGameSimulation({ difficulty: "hard" });
    upgraded.getState().thermal.tempC = 140;
    upgraded.getState().ownedUpgradeIds.push("upgrade-heat-resistant");
    expect(upgraded.getSnapshot().temperatureState).not.toBe("failure");
  });

  it("survives longer and to a hotter temperature before failing", () => {
    const base = runawayToFailure(false);
    const upgraded = runawayToFailure(true);
    expect(base.ticks).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(upgraded.ticks).toBeGreaterThan(base.ticks);
    // The heat-resistant loco only fails once past the raised ceiling.
    expect(upgraded.tempC).toBeGreaterThan(TEMP_FAILURE_C + 20);
  });
});

describe("emergency fuel recovery (relaxed mode)", () => {
  /** Sets up a train stranded dry between stations in relaxed mode. */
  function strandedSim(money: number): ReturnType<typeof createGameSimulation> {
    const sim = createGameSimulation({
      seed: 1,
      fireEnabled: false,
      startingMoney: money,
    });
    const st = sim.getState();
    st.physics.positionX = 1200; // flat section (grade 0), away from stations
    st.physics.speed = 0;
    st.fuel.litres = 0;
    return sim;
  }

  it("tops up the tank after the stranded delay so the run continues", () => {
    const sim = strandedSim(0);
    for (let i = 0; i < 60 * 12; i++) {
      sim.applyAction({ throttle: 1 });
      sim.tick(DT);
      if (sim.getSnapshot().emergencyRefuelCount > 0) break;
    }
    const s = sim.getSnapshot();
    expect(s.emergencyRefuelCount).toBe(1);
    expect(s.runState).toBe("running");
    expect(s.fuelLitres).toBeCloseTo(
      s.fuelCapacity * EMERGENCY_REFUEL_FRACTION,
      3,
    );
  });

  it("charges a penalty clamped to available money (never below 0)", () => {
    const rich = strandedSim(EMERGENCY_REFUEL_PENALTY + 500);
    for (let i = 0; i < 60 * 12; i++) {
      rich.tick(DT);
      if (rich.getSnapshot().emergencyRefuelCount > 0) break;
    }
    expect(rich.getSnapshot().money).toBe(500);

    const broke = strandedSim(0);
    for (let i = 0; i < 60 * 12; i++) {
      broke.tick(DT);
      if (broke.getSnapshot().emergencyRefuelCount > 0) break;
    }
    expect(broke.getSnapshot().money).toBe(0);
  });

  it("does not rescue when the fire chase is active", () => {
    const sim = createGameSimulation({ seed: 1, fireEnabled: true });
    const st = sim.getState();
    st.physics.positionX = 1200;
    st.physics.speed = 0;
    st.fuel.litres = 0;
    st.fire.positionX = -1_000_000; // keep the fire away so the run continues
    for (let i = 0; i < 60 * 12; i++) sim.tick(DT);
    const s = sim.getSnapshot();
    expect(s.emergencyRefuelCount).toBe(0);
    expect(s.fuelLitres).toBe(0);
  });

  it("does not rescue while the player can self-rescue at a fuel station", () => {
    const sim = createGameSimulation({
      seed: 1,
      fireEnabled: false,
      startingMoney: 1_000,
    });
    const st = sim.getState();
    st.physics.positionX = 400; // Cinderport Harbour (has refuel)
    st.physics.speed = 0;
    st.fuel.litres = 0;
    for (let i = 0; i < 60 * 12; i++) sim.tick(DT);
    expect(sim.getSnapshot().emergencyRefuelCount).toBe(0);
  });
});

describe("difficulty save/load round-trip", () => {
  it("preserves difficulty and the scaled time limit across save/load", () => {
    const storage = fakeStorage();
    const sim = createGameSimulation({ seed: 7, difficulty: "easy" });
    for (let i = 0; i < 120; i++) sim.tick(DT);
    saveGame(sim.getState(), storage);

    const sim2 = createGameSimulation({ difficulty: "hard" });
    sim2.setState(loadGame(storage)!);
    const s = sim2.getSnapshot();
    expect(s.difficulty).toBe("easy");
    expect(s.timeLimitS).toBe(
      Math.round(
        RUN_TIME_LIMIT_S * DIFFICULTY_MODIFIERS.easy.timeLimitMultiplier,
      ),
    );
  });

  it("defaults legacy saves (no difficulty) to hard", () => {
    const sim = createGameSimulation({ seed: 1 });
    const legacy = sim.getState();
    delete (legacy as Partial<typeof legacy>).difficulty;
    const sim2 = createGameSimulation({ difficulty: "easy" });
    sim2.setState(legacy);
    expect(sim2.getSnapshot().difficulty).toBe("hard");
  });
});
