import { describe, expect, it } from "vitest";
import { planFlameSlots } from "./FireFrontView";

const COLS = 13;
const ROWS = 6;
const TILE_DEPTH = 90;
const FRONT_DEPTH = 60;

describe("planFlameSlots", () => {
  const slots = planFlameSlots(COLS, ROWS, TILE_DEPTH, FRONT_DEPTH);

  it("produces one slot per grid cell", () => {
    expect(slots).toHaveLength(COLS * ROWS);
  });

  it("is deterministic for the same inputs", () => {
    const a = planFlameSlots(COLS, ROWS, TILE_DEPTH, FRONT_DEPTH);
    const b = planFlameSlots(COLS, ROWS, TILE_DEPTH, FRONT_DEPTH);
    expect(a).toEqual(b);
  });

  it("spans the full tile depth edge to edge across Z", () => {
    const half = TILE_DEPTH / 2;
    const zs = slots.map((s) => s.z);
    // Every flame stays within the tile footprint.
    for (const z of zs) {
      expect(z).toBeGreaterThanOrEqual(-half);
      expect(z).toBeLessThanOrEqual(half);
    }
    // Coverage reaches both tile edges (not a narrow band by the track).
    expect(Math.min(...zs)).toBe(-half);
    expect(Math.max(...zs)).toBe(half);
  });

  it("trails the flame band behind the front along X", () => {
    const xs = slots.map((s) => s.x);
    for (const x of xs) {
      expect(x).toBeLessThanOrEqual(0);
      expect(x).toBeGreaterThanOrEqual(-FRONT_DEPTH);
    }
    // Front row sits at the leading edge; back row reaches the band depth.
    expect(Math.max(...xs)).toBeCloseTo(0);
    expect(Math.min(...xs)).toBeCloseTo(-FRONT_DEPTH);
  });

  it("keeps base scales positive with a slight falloff toward the back", () => {
    for (const s of slots) {
      expect(s.baseScale).toBeGreaterThan(0);
      expect(s.depthT).toBeGreaterThanOrEqual(0);
      expect(s.depthT).toBeLessThanOrEqual(1);
    }
  });
});
