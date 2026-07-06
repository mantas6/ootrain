/**
 * Unit tests for the pure world-strip geometry helpers.
 *
 * These derive silhouette/station geometry from the shared route data. They
 * assert on normalisation and SVG conversion, not on any DOM.
 */

import { describe, expect, it } from "vitest";
import { STATIONS } from "../game/data";
import {
  buildElevationSilhouette,
  buildStripStations,
  silhouetteToPolyline,
} from "./worldStrip";

describe("buildElevationSilhouette", () => {
  const silhouette = buildElevationSilhouette();

  it("starts at x=0 and ends at x=1", () => {
    expect(silhouette[0].x).toBe(0);
    expect(silhouette[silhouette.length - 1].x).toBe(1);
  });

  it("keeps all x and y within 0..1", () => {
    for (const p of silhouette) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it("normalises so the peak reaches 1 (route gains elevation)", () => {
    const maxY = Math.max(...silhouette.map((p) => p.y));
    expect(maxY).toBeCloseTo(1, 5);
  });
});

describe("buildStripStations", () => {
  const stations = buildStripStations();

  it("returns one entry per station in order", () => {
    expect(stations).toHaveLength(STATIONS.length);
    expect(stations[0].id).toBe(STATIONS[0].id);
  });

  it("places stations monotonically along the strip", () => {
    for (let i = 1; i < stations.length; i++) {
      expect(stations[i].x).toBeGreaterThanOrEqual(stations[i - 1].x);
    }
  });
});

describe("silhouetteToPolyline", () => {
  it("produces one 'x,y' pair per point with padding applied", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const out = silhouetteToPolyline(points, 100, 50, 5, 5);
    const pairs = out.split(" ");
    expect(pairs).toHaveLength(2);
    // First point: x=0 -> "0.0", y=0 (lowest) sits at bottom (height - pad).
    expect(pairs[0]).toBe("0.0,45.0");
    // Second point: x=1 -> width, y=1 (peak) sits at top pad.
    expect(pairs[1]).toBe("100.0,5.0");
  });
});
