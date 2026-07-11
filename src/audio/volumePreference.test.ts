/**
 * Unit tests for the pure volume-preference logic + storage round-trip.
 *
 * No AudioContext / DOM — an injected in-memory storage exercises load/save.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_VOLUME,
  loadVolume,
  parseVolume,
  saveVolume,
  type VolumeStorage,
} from "./volumePreference";

/** A trivial in-memory storage for injection. */
function memory(initial: Record<string, string> = {}): VolumeStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe("parseVolume", () => {
  it("returns the fallback for a missing value", () => {
    expect(parseVolume(null)).toBe(DEFAULT_VOLUME);
    expect(parseVolume(null, 0.3)).toBe(0.3);
  });

  it("returns the fallback for a non-numeric value", () => {
    expect(parseVolume("loud", 0.5)).toBe(0.5);
  });

  it("parses a valid number", () => {
    expect(parseVolume("0.5")).toBe(0.5);
    expect(parseVolume("0")).toBe(0);
    expect(parseVolume("1")).toBe(1);
  });

  it("clamps out-of-range values to 0..1", () => {
    expect(parseVolume("-2")).toBe(0);
    expect(parseVolume("5")).toBe(1);
  });
});

describe("loadVolume / saveVolume", () => {
  it("round-trips a stored volume", () => {
    const store = memory();
    saveVolume(0.42, store);
    expect(loadVolume(store)).toBe(0.42);
  });

  it("clamps on save", () => {
    const store = memory();
    saveVolume(2, store);
    expect(loadVolume(store)).toBe(1);
  });

  it("returns the default when nothing is stored", () => {
    expect(loadVolume(memory())).toBe(DEFAULT_VOLUME);
  });
});
