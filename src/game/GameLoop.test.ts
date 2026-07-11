import { describe, expect, it } from "vitest";

import { GameLoop, type ControlSource, type LoopSim } from "./GameLoop";
import type { GameSnapshot, TrainAction } from "./simulation/types";

/** A minimal fake snapshot (only fields the loop touches are meaningful). */
function fakeSnapshot(): GameSnapshot {
  return {
    positionX: 0,
    speed: 0,
    grade: 0,
    reverse: false,
    fuelLitres: 0,
    fuelCapacity: 0,
    temperatureC: 0,
    temperatureState: "safe",
    engineRpm: 600,
    tractionState: "gripping",
    slipRatio: 0,
    damage: 0,
    wheelDamage: 0,
    totalMassKg: 0,
    cargo: [],
    money: 0,
    locomotiveId: "loco-1",
    ownedUpgradeIds: [],
    station: {
      stationId: null,
      stationName: null,
      distanceM: Infinity,
      inRange: false,
      interactions: [],
    },
    fireEnabled: true,
    difficulty: "hard",
    fireFrontX: 0,
    fireDistanceM: 0,
    timeLimitS: 780,
    timeRemainingS: 0,
    emergencyRefuelCount: 0,
    runState: "running",
    runEndReason: "none",
    progress: 0,
  };
}

/** A spy sim recording tick count and every applied action. */
function makeFakeSim(): LoopSim & {
  ticks: number;
  actions: TrainAction[];
} {
  const state = {
    ticks: 0,
    actions: [] as TrainAction[],
    tick(): void {
      this.ticks++;
    },
    applyAction(action: TrainAction): void {
      this.actions.push(action);
    },
    getSnapshot(): GameSnapshot {
      return fakeSnapshot();
    },
  };
  return state;
}

/** A fixed control source with configurable state + edges. */
function makeControls(
  state: { throttle: number; brake: number; reverse: boolean } = {
    throttle: 0,
    brake: 0,
    reverse: false,
  },
  edges: { reverse: boolean; interact: boolean } = {
    reverse: false,
    interact: false,
  },
): ControlSource & { edgeReads: number } {
  return {
    edgeReads: 0,
    getState: () => state,
    consumeEdges() {
      this.edgeReads++;
      // Edges are one-shot: return once, then clear.
      const out = { ...edges };
      edges.reverse = false;
      edges.interact = false;
      return out;
    },
  };
}

const SIM_DT = 1 / 60;

describe("GameLoop fixed-timestep", () => {
  it("first advance seeds timing and does not tick", () => {
    const sim = makeFakeSim();
    const loop = new GameLoop({
      sim,
      controls: makeControls(),
      publishUi: () => {},
      simDt: SIM_DT,
    });
    loop.advance(1000);
    expect(sim.ticks).toBe(0);
  });

  it("runs the correct number of sim steps for elapsed frame time", () => {
    const sim = makeFakeSim();
    const loop = new GameLoop({
      sim,
      controls: makeControls(),
      publishUi: () => {},
      simDt: SIM_DT,
    });
    loop.advance(0);
    // 100 ms elapsed => 6 steps of 1/60 s (0.1 / 0.01667 = 6).
    loop.advance(100);
    expect(sim.ticks).toBe(6);
    // Another 100 ms carries the leftover accumulator forward deterministically.
    loop.advance(200);
    expect(sim.ticks).toBe(12);
  });

  it("clamps huge deltas (e.g. tab refocus) to maxFrameDt", () => {
    const sim = makeFakeSim();
    const loop = new GameLoop({
      sim,
      controls: makeControls(),
      publishUi: () => {},
      simDt: SIM_DT,
      maxFrameDt: 0.1,
    });
    loop.advance(0);
    // A 60-second gap must not produce 3600 catch-up ticks — clamped to 0.1 s.
    loop.advance(60_000);
    expect(sim.ticks).toBe(6);
  });

  it("applies a control action for each sim step", () => {
    const sim = makeFakeSim();
    const controls = makeControls({
      throttle: 0.5,
      brake: 0.2,
      reverse: false,
    });
    const loop = new GameLoop({
      sim,
      controls,
      publishUi: () => {},
      simDt: SIM_DT,
    });
    loop.advance(0);
    loop.advance(100); // 6 steps
    expect(sim.actions).toHaveLength(6);
    for (const a of sim.actions) {
      expect(a.throttle).toBe(0.5);
      expect(a.brake).toBe(0.2);
    }
  });

  it("folds reverse and interact edges into the action once", () => {
    const sim = makeFakeSim();
    const controls = makeControls(
      { throttle: 0, brake: 0, reverse: true },
      { reverse: true, interact: true },
    );
    const loop = new GameLoop({
      sim,
      controls,
      publishUi: () => {},
      simDt: SIM_DT,
    });
    loop.advance(0);
    loop.advance(100); // 6 steps, edges only fire on the first
    const withReverse = sim.actions.filter((a) => a.reverse === true);
    const withInteract = sim.actions.filter((a) => a.interact === true);
    expect(withReverse).toHaveLength(1);
    expect(withInteract).toHaveLength(1);
  });

  it("does not tick while paused, and resumes without a catch-up burst", () => {
    const sim = makeFakeSim();
    const loop = new GameLoop({
      sim,
      controls: makeControls(),
      publishUi: () => {},
      simDt: SIM_DT,
    });
    loop.advance(0);
    loop.pause();
    // Time passes while paused: no ticks accrue.
    loop.advance(5000);
    expect(sim.ticks).toBe(0);
    loop.resume();
    // Resuming continues from "now"; the paused gap is not replayed.
    loop.advance(5100); // 100 ms after resume => 6 steps
    expect(sim.ticks).toBe(6);
  });

  it("publishes on the modest cadence, not every step", () => {
    const sim = makeFakeSim();
    let publishes = 0;
    const loop = new GameLoop({
      sim,
      controls: makeControls(),
      publishUi: () => {
        publishes++;
      },
      simDt: SIM_DT,
      publishDt: 1 / 20, // 50 ms
    });
    loop.advance(0); // initial publish
    expect(publishes).toBe(1);
    loop.advance(20); // < 50 ms, no publish
    expect(publishes).toBe(1);
    loop.advance(60); // total 60 ms >= 50 ms, publish
    expect(publishes).toBe(2);
  });

  it("feeds the audio callback with the accumulated publish dt", () => {
    const sim = makeFakeSim();
    const audioDts: number[] = [];
    const loop = new GameLoop({
      sim,
      controls: makeControls(),
      publishUi: () => {},
      updateAudio: (_snap, dt) => audioDts.push(dt),
      simDt: SIM_DT,
      publishDt: 1 / 20,
    });
    loop.advance(0);
    loop.advance(60);
    expect(audioDts).toHaveLength(1);
    expect(audioDts[0]).toBeGreaterThanOrEqual(0.05);
  });
});
