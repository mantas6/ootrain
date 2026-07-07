import { describe, expect, it } from "vitest";

import { createGameSimulation } from "./Game";
import { FINISH_POSITION_X, STATIONS } from "./data/stations";
import { LOCO_2 } from "./data/locomotives";
import {
  ENGINE_IDLE_RPM,
  ENGINE_MAX_RPM,
  STATION_RANGE_M,
} from "./simulation/constants";

const DT = 1 / 30;

/** Stations that sell fuel, in route order. */
const REFUEL_STATIONS = STATIONS.filter((st) => st.services.refuel);

/**
 * Drives forward at full throttle (easing when hot) and manages fuel like a
 * real playthrough. Fuel is now a real constraint (see constants.ts "Fuel"), so
 * a naive full-throttle dash runs dry: this harness "pit-stops" at every refuel
 * station it reaches to top up, and buys the loco-2 upgrade at the repair depot
 * because loco-1's tank cannot clear the final climb on its own.
 *
 * The pit-stop is modelled by zeroing speed when the train is physically within
 * a station's range (no teleporting — every metre is still driven) and issuing
 * the station actions in the same tick, so stops add fuel/restart cost without
 * adding dwell time.
 */
function autoDrive(
  sim: ReturnType<typeof createGameSimulation>,
  maxTicks: number,
): void {
  const serviced = new Set<string>();
  let boughtLoco2 = false;
  for (let i = 0; i < maxTicks; i++) {
    const s = sim.getSnapshot();
    if (s.runState !== "running") return;

    // Pit-stop at each refuel station as we reach it (once).
    for (const station of REFUEL_STATIONS) {
      if (serviced.has(station.id)) continue;
      if (Math.abs(station.positionX - s.positionX) > STATION_RANGE_M) continue;
      sim.getState().physics.speed = 0; // come to a stop at the platform
      if (station.id === "station-repair-depot" && !boughtLoco2) {
        sim.applyAction({ buyUpgradeId: "upgrade-loco-2" });
        boughtLoco2 = sim.getSnapshot().locomotiveId === "loco-2";
      }
      sim.applyAction({ refuel: true });
      serviced.add(station.id);
    }

    const cur = sim.getSnapshot();
    const hot =
      cur.temperatureState === "warning" || cur.temperatureState === "critical";
    sim.applyAction({ throttle: hot ? 0.5 : 1, brake: 0 });
    sim.tick(DT);
  }
}

describe("createGameSimulation basics", () => {
  it("produces a well-formed initial snapshot", () => {
    const sim = createGameSimulation({ seed: 1 });
    const s = sim.getSnapshot();
    expect(s.positionX).toBe(0);
    expect(s.speed).toBe(0);
    expect(s.runState).toBe("running");
    expect(s.locomotiveId).toBe("loco-1");
    expect(s.fuelLitres).toBeGreaterThan(0);
    expect(s.temperatureState).toBe("safe");
    expect(s.progress).toBe(0);
  });

  it("accelerates forward under throttle", () => {
    const sim = createGameSimulation({ seed: 1 });
    sim.applyAction({ throttle: 1 });
    for (let i = 0; i < 60; i++) sim.tick(DT);
    const s = sim.getSnapshot();
    expect(s.speed).toBeGreaterThan(1);
    expect(s.positionX).toBeGreaterThan(0);
  });
});

describe("engine RPM", () => {
  it("starts at idle in the initial snapshot", () => {
    const sim = createGameSimulation({ seed: 1 });
    expect(sim.getSnapshot().engineRpm).toBe(ENGINE_IDLE_RPM);
  });

  it("rises toward the max target when the throttle opens", () => {
    const sim = createGameSimulation({ seed: 1 });
    sim.applyAction({ throttle: 1 });
    sim.tick(DT);
    const afterOneTick = sim.getSnapshot().engineRpm;
    // Spooling: above idle but not instantly at max.
    expect(afterOneTick).toBeGreaterThan(ENGINE_IDLE_RPM);
    expect(afterOneTick).toBeLessThan(ENGINE_MAX_RPM);
    for (let i = 0; i < 300; i++) sim.tick(DT);
    expect(sim.getSnapshot().engineRpm).toBeGreaterThan(ENGINE_MAX_RPM - 5);
  });

  it("falls back toward idle when the throttle closes", () => {
    const sim = createGameSimulation({ seed: 1 });
    sim.applyAction({ throttle: 1 });
    for (let i = 0; i < 300; i++) sim.tick(DT);
    const revved = sim.getSnapshot().engineRpm;
    expect(revved).toBeGreaterThan(ENGINE_MAX_RPM - 5);

    sim.applyAction({ throttle: 0 });
    for (let i = 0; i < 600; i++) sim.tick(DT);
    expect(sim.getSnapshot().engineRpm).toBeCloseTo(ENGINE_IDLE_RPM, 0);
  });
});

describe("happy-path mini-run", () => {
  it("reaches the finish and wins with fuel management + the loco-2 upgrade", () => {
    // Enough money to buy loco-2 (required for the final climb — see the fuel
    // balance below) and pay for refuels along the way.
    const sim = createGameSimulation({ seed: 1, startingMoney: 30_000 });
    autoDrive(sim, 30 * 800);
    const s = sim.getSnapshot();
    expect(s.runState).toBe("won");
    expect(s.runEndReason).toBe("reached-finish");
    expect(s.positionX).toBeGreaterThanOrEqual(FINISH_POSITION_X);
    expect(s.timeRemainingS).toBeGreaterThan(0);
    // The starter loco cannot make the summit climb on one tank; a winning run
    // must have upgraded to loco-2 (see constants.ts "Fuel").
    expect(s.locomotiveId).toBe("loco-2");
  });
});

describe("station interactions", () => {
  it("picks up cargo (adds weight) and delivers it for money", () => {
    const sim = createGameSimulation({ seed: 1, startingMoney: 1_000 });

    // Drive to the port station (x=400) and stop there.
    const st = sim.getState();
    st.physics.positionX = 400;
    st.physics.speed = 0;

    const before = sim.getSnapshot();
    expect(before.station.stationId).toBe("station-port");
    expect(before.station.inRange).toBe(true);

    sim.applyAction({ acceptCargoId: "cargo-port-mail" });
    const afterPickup = sim.getSnapshot();
    expect(afterPickup.cargo.some((c) => c.jobId === "cargo-port-mail")).toBe(
      true,
    );
    expect(afterPickup.totalMassKg).toBeGreaterThan(before.totalMassKg);

    // Move to the delivery station (lower town, x=2600) and deliver.
    const st2 = sim.getState();
    st2.physics.positionX = 2600;
    st2.physics.speed = 0;
    const moneyBefore = sim.getSnapshot().money;
    sim.applyAction({ interact: true });
    const afterDeliver = sim.getSnapshot();
    expect(afterDeliver.cargo.some((c) => c.jobId === "cargo-port-mail")).toBe(
      false,
    );
    expect(afterDeliver.money).toBeGreaterThan(moneyBefore);
  });

  it("delivers finish-destined cargo on reaching the finish", () => {
    const sim = createGameSimulation({ seed: 1, startingMoney: 1_000 });
    const st = sim.getState();
    st.physics.positionX = 400;
    sim.applyAction({ acceptCargoId: "cargo-port-machinery" });
    expect(
      sim.getSnapshot().cargo.some((c) => c.jobId === "cargo-port-machinery"),
    ).toBe(true);

    const moneyBefore = sim.getSnapshot().money;
    // Jump near the finish and roll over the line.
    const st2 = sim.getState();
    st2.physics.positionX = FINISH_POSITION_X - 5;
    st2.physics.speed = 10;
    sim.applyAction({ throttle: 1 });
    for (let i = 0; i < 30; i++) {
      sim.tick(DT);
      if (sim.getSnapshot().runState !== "running") break;
    }
    const s = sim.getSnapshot();
    expect(s.runState).toBe("won");
    expect(s.money).toBeGreaterThan(moneyBefore);
    expect(s.cargo.length).toBe(0);
  });

  it("only allows interactions when stopped in range", () => {
    const sim = createGameSimulation({ seed: 1 });
    const st = sim.getState();
    st.physics.positionX = 400;
    st.physics.speed = 20; // moving — not stopped

    sim.applyAction({ acceptCargoId: "cargo-port-mail" });
    expect(sim.getSnapshot().cargo.length).toBe(0);
    expect(sim.getSnapshot().station.inRange).toBe(false);
  });
});

describe("economy interactions", () => {
  it("repair reduces damage and costs money", () => {
    const sim = createGameSimulation({ seed: 1, startingMoney: 20_000 });
    const st = sim.getState();
    st.physics.positionX = 2600; // lower town (has repair)
    st.physics.speed = 0;
    st.wear.damage = 0.4;
    st.wear.wheelDamage = 0.1;

    const moneyBefore = sim.getSnapshot().money;
    sim.applyAction({ repair: true });
    const s = sim.getSnapshot();
    expect(s.damage).toBeLessThan(0.4);
    expect(s.money).toBeLessThan(moneyBefore);
  });

  it("refuel restores fuel and costs money", () => {
    const sim = createGameSimulation({ seed: 1, startingMoney: 20_000 });
    const st = sim.getState();
    st.physics.positionX = 400; // port (has refuel)
    st.physics.speed = 0;
    st.fuel.litres = 500;

    const moneyBefore = sim.getSnapshot().money;
    sim.applyAction({ refuel: true });
    const s = sim.getSnapshot();
    expect(s.fuelLitres).toBeGreaterThan(500);
    expect(s.money).toBeLessThan(moneyBefore);
  });

  it("buying the loco-2 upgrade swaps locomotive stats", () => {
    const sim = createGameSimulation({ seed: 1, startingMoney: 20_000 });
    const st = sim.getState();
    st.physics.positionX = 7500; // repair depot sells loco-2
    st.physics.speed = 0;

    expect(sim.getSnapshot().locomotiveId).toBe("loco-1");
    const moneyBefore = sim.getSnapshot().money;
    sim.applyAction({ buyUpgradeId: "upgrade-loco-2" });
    const s = sim.getSnapshot();
    expect(s.locomotiveId).toBe("loco-2");
    expect(s.money).toBe(moneyBefore - LOCO_2.price);
    expect(s.ownedUpgradeIds).toContain("upgrade-loco-2");
    expect(s.fuelCapacity).toBe(LOCO_2.fuelCapacity);
  });

  it("cannot buy an upgrade not sold at the current station", () => {
    const sim = createGameSimulation({ seed: 1, startingMoney: 20_000 });
    const st = sim.getState();
    st.physics.positionX = 400; // port has no upgrades
    st.physics.speed = 0;
    sim.applyAction({ buyUpgradeId: "upgrade-loco-2" });
    expect(sim.getSnapshot().locomotiveId).toBe("loco-1");
  });
});

describe("fuel gating", () => {
  it("delivers no thrust with an empty tank but can still coast", () => {
    const sim = createGameSimulation({ seed: 1 });
    const st = sim.getState();
    st.fuel.litres = 0;
    st.physics.positionX = 2000;
    st.physics.speed = 8; // coasting on the flat

    sim.applyAction({ throttle: 1 });
    const startX = sim.getSnapshot().positionX;
    for (let i = 0; i < 30; i++) sim.tick(DT);
    const s = sim.getSnapshot();
    // No power means it decelerates but still coasts forward a bit.
    expect(s.positionX).toBeGreaterThan(startX);
    expect(s.speed).toBeLessThan(8);
  });
});

describe("temperature failure ends the run", () => {
  it("fails with engine-failure at max temperature", () => {
    // A hot, damaged engine held stationary (brake) while flooring the throttle
    // under heavy load: the engine strains with no airflow cooling, so heat
    // outpaces cooling and climbs to the failure threshold. This models a
    // player ignoring the warning/critical alarms.
    const sim = createGameSimulation({ seed: 1 });
    const st = sim.getState();
    st.thermal.tempC = 125;
    st.wear.damage = 0.6;
    st.physics.positionX = 6000;
    st.physics.speed = 0;
    st.fire.positionX = -90_000; // keep fire away so temp fails first
    st.cargo.push({
      jobId: "heavy",
      wagonCount: 4,
      totalWeightKg: 120_000,
      destinationStationId: "finish",
      payment: 0,
    });
    sim.applyAction({ throttle: 1, brake: 1 });
    let failed = false;
    for (let i = 0; i < 30 * 120; i++) {
      sim.applyAction({ throttle: 1, brake: 1 });
      sim.tick(DT);
      const s = sim.getSnapshot();
      if (s.runState === "failed") {
        expect(s.runEndReason).toBe("engine-failure");
        expect(s.temperatureC).toBeGreaterThanOrEqual(135);
        failed = true;
        break;
      }
    }
    expect(failed).toBe(true);
  });
});

describe("fire and timer failure", () => {
  it("fire catches a stationary train and fails the run", () => {
    const sim = createGameSimulation({ seed: 1 });
    const st = sim.getState();
    st.physics.positionX = 300;
    st.physics.speed = 0;
    let caught = false;
    for (let i = 0; i < 30 * 300; i++) {
      sim.tick(DT);
      const s = sim.getSnapshot();
      if (s.runState === "failed") {
        expect(s.runEndReason).toBe("fire-caught");
        caught = true;
        break;
      }
    }
    expect(caught).toBe(true);
  });

  it("times out when the clock runs out short of the finish", () => {
    const sim = createGameSimulation({ seed: 1, timeLimitS: 5 });
    const st = sim.getState();
    // Park it far from the fire so the timer expires first.
    st.fire.positionX = -100_000;
    st.physics.positionX = 1_000;
    st.physics.speed = 0;
    let timedOut = false;
    for (let i = 0; i < 30 * 10; i++) {
      sim.tick(DT);
      const s = sim.getSnapshot();
      if (s.runState === "failed") {
        expect(s.runEndReason).toBe("time-out");
        timedOut = true;
        break;
      }
    }
    expect(timedOut).toBe(true);
  });
});

describe("balance: buffed acceleration from a standstill", () => {
  /** Seconds of full-throttle acceleration from rest to `target` m/s on the
   *  flat lower-town section (x=1200, grade 0). Returns Infinity if not hit. */
  function timeToSpeed(locoId: string, target: number): number {
    const sim = createGameSimulation({ seed: 1, locomotiveId: locoId });
    const st = sim.getState();
    st.physics.positionX = 1200; // flat section (grade 0)
    st.physics.speed = 0;
    st.fire.positionX = -1_000_000; // isolate acceleration from the fire
    sim.applyAction({ throttle: 1, brake: 0 });
    for (let i = 0; i < 30 * 60; i++) {
      sim.tick(DT);
      if (sim.getSnapshot().speed >= target) return (i + 1) * DT;
    }
    return Number.POSITIVE_INFINITY;
  }

  it("loco-1 reaches 15 m/s from rest promptly on the flat", () => {
    // Balance guard for the acceleration buff (power + effort + adhesion): the
    // starter should hit ~54 km/h within ~9 s (measured ~8.7 s; was ~10.4 s).
    expect(timeToSpeed("loco-1", 15)).toBeLessThan(10);
  });

  it("the more powerful loco-2 out-accelerates loco-1 to cruise", () => {
    expect(timeToSpeed("loco-2", 20)).toBeLessThan(timeToSpeed("loco-1", 20));
  });
});

describe("balance: loco-2 outperforms loco-1 on the steep late grade", () => {
  it("loco-2 climbs the 7% grade faster than loco-1", () => {
    function climb(locoId: string): number {
      const sim = createGameSimulation({ seed: 1, locomotiveId: locoId });
      const st = sim.getState();
      st.physics.positionX = 9500; // start of the 7% climb
      st.physics.speed = 12;
      sim.applyAction({ throttle: 1 });
      for (let i = 0; i < 30 * 120; i++) {
        sim.tick(DT);
        const s = sim.getSnapshot();
        if (s.positionX >= 11_000) return i; // ticks to crest the 7% section
        if (s.runState !== "running") return Number.POSITIVE_INFINITY;
      }
      return Number.POSITIVE_INFINITY;
    }
    const loco1Ticks = climb("loco-1");
    const loco2Ticks = climb("loco-2");
    expect(loco2Ticks).toBeLessThan(loco1Ticks);
  });

  it("loco-2 handles heavy cargo on the steep grade where loco-1 stalls out", () => {
    function climbHeavy(locoId: string): {
      crested: boolean;
      minSpeed: number;
    } {
      const sim = createGameSimulation({ seed: 1, locomotiveId: locoId });
      const st = sim.getState();
      st.physics.positionX = 9500;
      st.physics.speed = 10;
      st.cargo.push({
        jobId: "heavy",
        wagonCount: 4,
        totalWeightKg: 136_000,
        destinationStationId: "finish",
        payment: 0,
      });
      sim.applyAction({ throttle: 1 });
      let minSpeed = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 30 * 150; i++) {
        sim.tick(DT);
        const s = sim.getSnapshot();
        minSpeed = Math.min(minSpeed, s.speed);
        if (s.positionX >= 11_000) return { crested: true, minSpeed };
        if (s.runState !== "running") return { crested: false, minSpeed };
      }
      return { crested: false, minSpeed };
    }
    const loco1 = climbHeavy("loco-1");
    const loco2 = climbHeavy("loco-2");
    // loco-1 crawls to a struggle; loco-2 keeps meaningful speed and crests.
    expect(loco2.minSpeed).toBeGreaterThan(loco1.minSpeed);
    expect(loco2.crested).toBe(true);
    expect(loco1.crested).toBe(false);
  });
});

describe("balance: fuel matters and paces refuelling", () => {
  // Refuelling requires stopping, so the sizing case is "cross the next
  // no-refuel stretch from a standstill at full throttle" (see constants.ts
  // "Fuel"). Measured engine work from a standstill, full throttle:
  //   loco-1 cargo-yard(3600)->repair-depot(7500), 3900 m: ~151,800 kW·s
  //          -> ~1973 L @0.013 ~ 79% of the 2500 L tank (crossable, tight).
  //   loco-1 bridge(8400)->summit(12900) FINALE, 4500 m: ~247,100 kW·s
  //          -> ~3213 L @0.013 > 2500 L tank (impossible -> forces loco-2).
  //   loco-2 bridge->summit FINALE: ~320,400 kW·s -> ~4485 L @0.014 ~ 75% of
  //          the 6000 L tank (crossable with headroom).

  /** Runs full throttle from a standstill at `fromX`; returns the snapshot at
   *  `toX` (reached) or when the tank runs dry / the run ends. */
  function driveFrom(
    locoId: string,
    fromX: number,
    toX: number,
  ): ReturnType<ReturnType<typeof createGameSimulation>["getSnapshot"]> {
    const sim = createGameSimulation({ seed: 1, locomotiveId: locoId });
    const st = sim.getState();
    st.physics.positionX = fromX;
    st.physics.speed = 0;
    st.fire.positionX = -1_000_000; // isolate fuel from the fire for this test
    for (let i = 0; i < 30 * 400; i++) {
      const s = sim.getSnapshot();
      if (s.positionX >= toX || s.runState !== "running" || s.fuelLitres <= 0) {
        return s;
      }
      const hot =
        s.temperatureState === "critical" || s.temperatureState === "failure";
      sim.applyAction({ throttle: hot ? 0.6 : 1, brake: 0 });
      sim.tick(DT);
    }
    return sim.getSnapshot();
  }

  it("a full loco-1 tank is a real, limited resource (empties within ~2-3 gaps)", () => {
    // From a fresh fill at the port, a full-throttle dash runs dry well before
    // reaching the repair depot 7100 m away — i.e. the player must refuel every
    // couple of stations, not once per run as before the retune.
    const s = driveFrom("loco-1", 400, 7500);
    expect(s.positionX).toBeLessThan(7500); // did NOT reach the depot on one tank
    expect(s.fuelLitres).toBeLessThanOrEqual(0); // it was fuel that stopped it
    // But it clears at least the first ~2 station gaps (past the cargo yard),
    // so the cadence is "roughly every other station", not "every gap".
    expect(s.positionX).toBeGreaterThan(3600);
  });

  it("loco-1 can just cross its longest no-refuel stretch (cargo->depot)", () => {
    const s = driveFrom("loco-1", 3600, 7500);
    expect(s.positionX).toBeGreaterThanOrEqual(7500);
    expect(s.fuelLitres).toBeGreaterThan(0);
    // Tight: it arrives with only a modest reserve (~a fifth of the tank).
    expect(s.fuelLitres).toBeLessThan(0.4 * s.fuelCapacity);
  });

  it("loco-1 cannot make the final climb on one tank (forces the upgrade)", () => {
    const s = driveFrom("loco-1", 8400, 12900);
    expect(s.positionX).toBeLessThan(12900);
    expect(s.fuelLitres).toBeLessThanOrEqual(0);
  });

  it("loco-2 clears the final climb on one tank with headroom", () => {
    const s = driveFrom("loco-2", 8400, 12900);
    expect(s.positionX).toBeGreaterThanOrEqual(12900);
    expect(s.fuelLitres).toBeGreaterThan(0.1 * s.fuelCapacity);
  });
});
