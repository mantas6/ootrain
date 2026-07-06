import { describe, expect, it } from "vitest";

import { createGameSimulation } from "./Game";
import { FINISH_POSITION_X } from "./data/stations";
import { LOCO_2 } from "./data/locomotives";

const DT = 1 / 30;

/** Drives forward, easing throttle when hot, until the run ends or n ticks. */
function autoDrive(
  sim: ReturnType<typeof createGameSimulation>,
  maxTicks: number,
): void {
  for (let i = 0; i < maxTicks; i++) {
    const s = sim.getSnapshot();
    if (s.runState !== "running") return;
    const hot =
      s.temperatureState === "warning" || s.temperatureState === "critical";
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

describe("happy-path mini-run", () => {
  it("reaches the finish and wins before the timer/fire", () => {
    const sim = createGameSimulation({ seed: 1 });
    autoDrive(sim, 30 * 800);
    const s = sim.getSnapshot();
    expect(s.runState).toBe("won");
    expect(s.runEndReason).toBe("reached-finish");
    expect(s.positionX).toBeGreaterThanOrEqual(FINISH_POSITION_X);
    expect(s.timeRemainingS).toBeGreaterThan(0);
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
