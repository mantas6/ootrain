import { describe, expect, it } from "vitest";
import {
  chunkIndexAt,
  chunkStartX,
  hashSeed,
  scatterInChunk,
  seededRandom,
  trackPitchAt,
  trackPointAt,
  visibleChunkRange,
} from "./routeGeometry";
import { ROUTE_LENGTH_M, getElevationAt, getGradeAt } from "../game/data";

describe("routeGeometry", () => {
  describe("trackPointAt", () => {
    it("maps route x to world x with z=0 and elevation as y", () => {
      const p = trackPointAt(2000);
      expect(p.x).toBe(2000);
      expect(p.z).toBe(0);
      expect(p.y).toBeCloseTo(getElevationAt(2000), 6);
    });

    it("adds a vertical lift", () => {
      const base = trackPointAt(1000);
      const lifted = trackPointAt(1000, 3);
      expect(lifted.y - base.y).toBeCloseTo(3, 6);
    });
  });

  describe("trackPitchAt", () => {
    it("is atan of the local grade", () => {
      const x = 9800; // inside the steep 7% climb
      expect(trackPitchAt(x)).toBeCloseTo(Math.atan(getGradeAt(x)), 6);
    });

    it("is positive on climbs and negative on descents", () => {
      expect(trackPitchAt(9800)).toBeGreaterThan(0); // 7% climb
      expect(trackPitchAt(2500)).toBeLessThan(0); // -3% descent segment
    });
  });

  describe("chunk math", () => {
    it("computes chunk index and start consistently", () => {
      expect(chunkIndexAt(0, 200)).toBe(0);
      expect(chunkIndexAt(199, 200)).toBe(0);
      expect(chunkIndexAt(200, 200)).toBe(1);
      expect(chunkStartX(3, 200)).toBe(600);
    });

    it("clamps the visible range to route bounds", () => {
      const atStart = visibleChunkRange(0, 200, 2, ROUTE_LENGTH_M);
      expect(atStart.min).toBe(0);
      expect(atStart.max).toBe(2);

      const atEnd = visibleChunkRange(ROUTE_LENGTH_M, 200, 2, ROUTE_LENGTH_M);
      const lastIndex = Math.floor(ROUTE_LENGTH_M / 200);
      expect(atEnd.max).toBe(lastIndex);
      expect(atEnd.min).toBe(lastIndex - 2);
    });

    it("keeps a symmetric window in the middle", () => {
      const r = visibleChunkRange(5000, 200, 3, ROUTE_LENGTH_M);
      expect(r.max - r.min).toBe(6);
    });

    it("streams a pre-start buffer behind the route start", () => {
      // The train head sits at x=0 while its body trails into negative X, so
      // with a negative floor the range must include chunk -1 (x in [-200, 0])
      // to keep ground/track under the whole train.
      const atStart = visibleChunkRange(0, 200, 4, ROUTE_LENGTH_M, -1);
      expect(atStart.min).toBe(-1);

      // Negative x (a trailing wagon) still resolves to a chunk that is resident
      // at the start.
      const tailChunk = chunkIndexAt(-30, 200);
      expect(tailChunk).toBe(-1);
      expect(tailChunk).toBeGreaterThanOrEqual(atStart.min);

      // The floor only matters near the start: once the train has advanced, the
      // window is driven by the radius, never dipping below the floor.
      const midway = visibleChunkRange(5000, 200, 4, ROUTE_LENGTH_M, -1);
      expect(midway.min).toBeGreaterThan(-1);
    });
  });

  describe("seeded randomness", () => {
    it("is deterministic for a given seed", () => {
      const a = seededRandom(1234);
      const b = seededRandom(1234);
      expect(a()).toBe(b());
      expect(a()).toBe(b());
    });

    it("produces values in [0,1)", () => {
      const r = seededRandom(99);
      for (let i = 0; i < 100; i++) {
        const v = r();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it("hashSeed is order sensitive and stable", () => {
      expect(hashSeed(1, 2)).toBe(hashSeed(1, 2));
      expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
    });
  });

  describe("scatterInChunk", () => {
    const params = {
      chunkIndex: 4,
      chunkSize: 200,
      count: 8,
      clearZ: 6,
      maxZ: 30,
    };

    it("produces a deterministic layout for the same chunk", () => {
      const a = scatterInChunk(params);
      const b = scatterInChunk(params);
      expect(a).toEqual(b);
    });

    it("keeps items out of the track corridor and inside the chunk", () => {
      const items = scatterInChunk(params);
      expect(items).toHaveLength(8);
      const startX = params.chunkIndex * params.chunkSize;
      for (const it of items) {
        expect(Math.abs(it.z)).toBeGreaterThanOrEqual(params.clearZ);
        expect(Math.abs(it.z)).toBeLessThanOrEqual(params.maxZ);
        expect(it.x).toBeGreaterThanOrEqual(startX);
        expect(it.x).toBeLessThanOrEqual(startX + params.chunkSize);
        expect(it.scale).toBeGreaterThan(0);
      }
    });

    it("differs between chunks", () => {
      const a = scatterInChunk({ ...params, chunkIndex: 4 });
      const b = scatterInChunk({ ...params, chunkIndex: 5 });
      expect(a).not.toEqual(b);
    });
  });
});
