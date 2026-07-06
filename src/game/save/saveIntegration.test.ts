import { describe, expect, it } from "vitest";

import {
  AutosaveScheduler,
  DEFAULT_AUTOSAVE_INTERVAL_S,
  hasResumableSave,
} from "./saveIntegration";
import { createGameSimulation } from "../Game";
import { clearSave, saveGame, type SaveStorage } from "./localStorageSave";

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

describe("AutosaveScheduler cadence", () => {
  it("fires once the interval accumulates and resets", () => {
    const sched = new AutosaveScheduler(5);
    expect(sched.tick(2)).toBe(false);
    expect(sched.tick(2)).toBe(false);
    expect(sched.tick(2)).toBe(true); // total 6 >= 5
    // Accumulator reset: needs another 5 s.
    expect(sched.tick(2)).toBe(false);
    expect(sched.tick(3)).toBe(true);
  });

  it("markSaved resets the accumulator so no immediate periodic save", () => {
    const sched = new AutosaveScheduler(5);
    sched.tick(4);
    sched.markSaved();
    expect(sched.tick(2)).toBe(false); // would have been 6 without reset
    expect(sched.tick(4)).toBe(true);
  });

  it("collapses a huge dt into a single save (no queue)", () => {
    const sched = new AutosaveScheduler(5);
    expect(sched.tick(100)).toBe(true);
    expect(sched.tick(0.1)).toBe(false);
  });

  it("ignores non-positive dt", () => {
    const sched = new AutosaveScheduler(5);
    expect(sched.tick(0)).toBe(false);
    expect(sched.tick(-3)).toBe(false);
  });

  it("uses the default interval when unspecified", () => {
    const sched = new AutosaveScheduler();
    expect(sched.tick(DEFAULT_AUTOSAVE_INTERVAL_S)).toBe(true);
  });
});

describe("hasResumableSave decision", () => {
  it("is false when nothing is saved", () => {
    const storage = fakeStorage();
    expect(hasResumableSave(storage)).toBe(false);
  });

  it("is true for a still-running saved run", () => {
    const storage = fakeStorage();
    const sim = createGameSimulation({ seed: 7 });
    saveGame(sim.getState(), storage);
    expect(hasResumableSave(storage)).toBe(true);
  });

  it("is false for a won/failed saved run", () => {
    const storage = fakeStorage();
    const sim = createGameSimulation({ seed: 7 });
    const state = sim.getState();
    state.runState = "won";
    saveGame(state, storage);
    expect(hasResumableSave(storage)).toBe(false);
  });

  it("is false after the save is cleared", () => {
    const storage = fakeStorage();
    const sim = createGameSimulation({ seed: 7 });
    saveGame(sim.getState(), storage);
    clearSave(storage);
    expect(hasResumableSave(storage)).toBe(false);
  });
});
