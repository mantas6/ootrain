import { describe, expect, it } from "vitest";

import {
  ROUTE_SEGMENTS,
  ROUTE_LENGTH_M,
  ROUTE_START_ELEVATION_M,
  ROUTE_FINISH_ELEVATION_M,
  getGradeAt,
  getElevationAt,
  getRouteLength,
} from "./route";

describe("route data integrity", () => {
  it("has at least one segment", () => {
    expect(ROUTE_SEGMENTS.length).toBeGreaterThan(0);
  });

  it("segments are contiguous with no gaps or overlaps", () => {
    let expectedStart = 0;
    for (const segment of ROUTE_SEGMENTS) {
      expect(segment.startX).toBe(expectedStart);
      expect(segment.length).toBeGreaterThan(0);
      expectedStart += segment.length;
    }
  });

  it("route length matches the sum of segment lengths and helper", () => {
    const summed = ROUTE_SEGMENTS.reduce((s, seg) => s + seg.length, 0);
    expect(ROUTE_LENGTH_M).toBe(summed);
    expect(getRouteLength()).toBe(ROUTE_LENGTH_M);
  });

  it("total length suits a 10-15 minute run (~12-20 km)", () => {
    expect(ROUTE_LENGTH_M).toBeGreaterThanOrEqual(12_000);
    expect(ROUTE_LENGTH_M).toBeLessThanOrEqual(20_000);
  });

  it("getGradeAt clamps below the start and at/after the end", () => {
    const first = ROUTE_SEGMENTS[0];
    const last = ROUTE_SEGMENTS[ROUTE_SEGMENTS.length - 1];
    expect(getGradeAt(-100)).toBe(first.grade);
    expect(getGradeAt(0)).toBe(first.grade);
    expect(getGradeAt(ROUTE_LENGTH_M)).toBe(last.grade);
    expect(getGradeAt(ROUTE_LENGTH_M + 500)).toBe(last.grade);
  });

  it("getGradeAt returns the owning segment's grade at boundaries", () => {
    // A boundary belongs to the segment that starts there.
    for (let i = 1; i < ROUTE_SEGMENTS.length; i += 1) {
      const segment = ROUTE_SEGMENTS[i];
      expect(getGradeAt(segment.startX)).toBe(segment.grade);
    }
    // Mid-segment lookups.
    for (const segment of ROUTE_SEGMENTS) {
      const mid = segment.startX + segment.length / 2;
      expect(getGradeAt(mid)).toBe(segment.grade);
    }
  });

  it("elevation integrates correctly from grades", () => {
    // Elevation at the start is the datum.
    expect(getElevationAt(0)).toBe(ROUTE_START_ELEVATION_M);

    // Elevation at each boundary equals the cumulative rise/run so far.
    let cumulative = ROUTE_START_ELEVATION_M;
    for (const segment of ROUTE_SEGMENTS) {
      const startElev = getElevationAt(segment.startX);
      expect(startElev).toBeCloseTo(cumulative, 6);
      cumulative += segment.grade * segment.length;
      const endElev = getElevationAt(segment.startX + segment.length);
      expect(endElev).toBeCloseTo(cumulative, 6);
    }

    // Mid-segment interpolation matches partial integration.
    const seg = ROUTE_SEGMENTS[4];
    const at = seg.startX + seg.length * 0.5;
    const expected =
      getElevationAt(seg.startX) + seg.grade * (seg.length * 0.5);
    expect(getElevationAt(at)).toBeCloseTo(expected, 6);
  });

  it("net elevation gain is positive (upward escape story)", () => {
    expect(ROUTE_FINISH_ELEVATION_M).toBeGreaterThan(ROUTE_START_ELEVATION_M);
    expect(getElevationAt(ROUTE_LENGTH_M)).toBe(ROUTE_FINISH_ELEVATION_M);
  });

  it("has at least one downhill section (mixed terrain)", () => {
    expect(ROUTE_SEGMENTS.some((s) => s.grade < 0)).toBe(true);
  });

  it("has a steep (>= 5%) segment in the later half of the route", () => {
    const halfway = ROUTE_LENGTH_M / 2;
    const steepLate = ROUTE_SEGMENTS.some(
      (s) => s.startX >= halfway && s.grade >= 0.05,
    );
    expect(steepLate).toBe(true);
  });
});
