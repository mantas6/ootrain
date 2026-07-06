import { describe, expect, it } from "vitest";

import { createGameSimulation } from "../Game";
import {
  clearSave,
  deserializeState,
  loadGame,
  saveGame,
  serializeState,
  type SaveStorage,
} from "./localStorageSave";

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

const DT = 1 / 60;

describe("save/load round-trip", () => {
  it("restores an identical snapshot through injected storage", () => {
    const storage = fakeStorage();
    const sim = createGameSimulation({ seed: 42, startingMoney: 5_000 });

    // Advance the sim into a non-trivial state.
    sim.applyAction({ throttle: 0.8 });
    for (let i = 0; i < 300; i++) sim.tick(DT);

    const before = sim.getSnapshot();
    saveGame(sim.getState(), storage);

    const restored = loadGame(storage);
    expect(restored).not.toBeNull();

    const sim2 = createGameSimulation();
    sim2.setState(restored!);
    const after = sim2.getSnapshot();

    expect(after).toEqual(before);
  });

  it("continues deterministically after a reload", () => {
    const storage = fakeStorage();
    const sim = createGameSimulation({ seed: 7 });
    sim.applyAction({ throttle: 0.6 });
    for (let i = 0; i < 120; i++) sim.tick(DT);
    saveGame(sim.getState(), storage);

    // Keep going on the original.
    for (let i = 0; i < 120; i++) sim.tick(DT);
    const originalContinued = sim.getSnapshot();

    // Reload and run the same additional ticks.
    const sim2 = createGameSimulation();
    sim2.setState(loadGame(storage)!);
    sim2.applyAction({ throttle: 0.6 });
    for (let i = 0; i < 120; i++) sim2.tick(DT);
    const reloadedContinued = sim2.getSnapshot();

    expect(reloadedContinued.positionX).toBeCloseTo(
      originalContinued.positionX,
      6,
    );
    expect(reloadedContinued.temperatureC).toBeCloseTo(
      originalContinued.temperatureC,
      6,
    );
  });

  it("serialize/deserialize handles invalid input gracefully", () => {
    expect(deserializeState("not json")).toBeNull();
    expect(deserializeState("{}")).toBeNull();
    const sim = createGameSimulation();
    const json = serializeState(sim.getState());
    expect(deserializeState(json)).not.toBeNull();
  });

  it("loadGame returns null when nothing is saved; clearSave removes it", () => {
    const storage = fakeStorage();
    expect(loadGame(storage)).toBeNull();
    const sim = createGameSimulation();
    saveGame(sim.getState(), storage);
    expect(loadGame(storage)).not.toBeNull();
    clearSave(storage);
    expect(loadGame(storage)).toBeNull();
  });
});
