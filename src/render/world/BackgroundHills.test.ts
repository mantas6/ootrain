import { describe, expect, it } from "vitest";
import { planBackgroundHills } from "./BackgroundHills";

const CHUNK = 200;

describe("planBackgroundHills", () => {
  it("is deterministic for a given chunk", () => {
    const a = planBackgroundHills({ chunkIndex: 42, chunkSize: CHUNK });
    const b = planBackgroundHills({ chunkIndex: 42, chunkSize: CHUNK });
    expect(a).toEqual(b);
  });

  it("varies between chunks", () => {
    const a = planBackgroundHills({ chunkIndex: 10, chunkSize: CHUNK });
    const b = planBackgroundHills({ chunkIndex: 11, chunkSize: CHUNK });
    expect(a).not.toEqual(b);
  });

  it("places every hill behind the track and near its chunk", () => {
    const idx = 7;
    const startX = idx * CHUNK;
    for (const h of planBackgroundHills({
      chunkIndex: idx,
      chunkSize: CHUNK,
    })) {
      // Always behind the track corridor.
      expect(h.z).toBeLessThan(0);
      // Positive footprint and height.
      expect(h.width).toBeGreaterThan(0);
      expect(h.height).toBeGreaterThan(0);
      // Centre sits within (or just past) the chunk span.
      expect(h.x).toBeGreaterThanOrEqual(startX);
      expect(h.x).toBeLessThan(startX + CHUNK);
    }
  });

  it("puts the far ridge deeper than the near ridge", () => {
    const hills = planBackgroundHills({ chunkIndex: 3, chunkSize: CHUNK });
    const far = hills.filter((h) => h.far);
    const near = hills.filter((h) => !h.far);
    expect(far.length).toBeGreaterThan(0);
    expect(near.length).toBeGreaterThan(0);
    const maxFarZ = Math.max(...far.map((h) => h.z));
    const minNearZ = Math.min(...near.map((h) => h.z));
    expect(maxFarZ).toBeLessThan(minNearZ);
  });
});
