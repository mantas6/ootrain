/**
 * Route profile for the single forward "Out of Time Train" run.
 *
 * The route is modelled as an ordered list of contiguous segments along the
 * world X axis (metres). Each segment has a constant grade (slope), so the
 * elevation profile is piecewise-linear. There is no branching: the train
 * always travels from x = 0 (burning coast) toward x = routeLength (rescue
 * summit).
 *
 * ## Length / duration justification
 * Target session is 10–15 minutes (TODO.md). Diesel road/rail freight cruises
 * roughly in the 40–90 km/h band; with hills, station stops, and traction
 * limits an *average* effective speed of ~55–65 km/h (~15–18 m/s) is
 * plausible for this arcade sim. Over ~12.5 minutes (750 s) that yields:
 *
 *   750 s * ~17 m/s ≈ 12750 m ≈ 12.75 km
 *
 * We pick a total length of 13000 m (13 km), which sits comfortably inside the
 * "~12–20 km" window and leaves headroom for station stops and slow climbs
 * that push the run toward the 15-minute end when the player is careless.
 *
 * ## Story shape (coast -> summit escape)
 * Net elevation gain is strongly positive: the run starts near sea level on a
 * burning coast and finishes high at the rescue summit. It is not monotonic —
 * there are flats, a short early descent (dropping into a river/cargo basin),
 * rolling grades, and a very steep late climb (the emotional escalation) before
 * a final approach into the summit village.
 */

/** A single contiguous stretch of track with a constant grade. */
export interface RouteSegment {
  /** World X position where this segment begins, metres. */
  startX: number;
  /** Horizontal length of the segment, metres. */
  length: number;
  /**
   * Grade (slope) as a dimensionless ratio of rise over run.
   * Positive = uphill in the travel direction, negative = downhill.
   * e.g. 0.04 = 4% climb, -0.02 = 2% descent.
   */
  grade: number;
}

/**
 * Ordered, contiguous route segments (no gaps or overlaps).
 *
 * Each segment's `startX` equals the previous segment's `startX + length`.
 * Total horizontal length sums to {@link ROUTE_LENGTH_M}.
 */
export const ROUTE_SEGMENTS: readonly RouteSegment[] = [
  // Burning coastal start: gentle rise off the port flats.
  { startX: 0, length: 1200, grade: 0.01 },
  // Lower town flats — easy driving to build speed.
  { startX: 1200, length: 1000, grade: 0.0 },
  // Short descent into the river / cargo basin.
  { startX: 2200, length: 900, grade: -0.03 },
  // Cargo-yard flats in the basin.
  { startX: 3100, length: 900, grade: 0.0 },
  // First sustained incline out of the basin toward the tunnel.
  { startX: 4000, length: 1300, grade: 0.035 },
  // Ash tunnel depot approach — rolling, near-flat.
  { startX: 5300, length: 900, grade: 0.008 },
  // Rolling descent through the tunnel gorge.
  { startX: 6200, length: 800, grade: -0.02 },
  // Mid-route incline toward the repair depot.
  { startX: 7000, length: 1100, grade: 0.03 },
  // Mountain-bridge span — flat crossing over the ravine.
  { startX: 8100, length: 700, grade: 0.0 },
  // Approach ramp before the big climb.
  { startX: 8800, length: 700, grade: 0.045 },
  // VERY STEEP late climb — the escalation moment (7%).
  { startX: 9500, length: 1500, grade: 0.07 },
  // Continued steep grind toward the ridge (6%).
  { startX: 11000, length: 900, grade: 0.06 },
  // Final approach into the summit village — easing off.
  { startX: 11900, length: 800, grade: 0.03 },
  // Last push to the rescue summit.
  { startX: 12700, length: 300, grade: 0.02 },
];

/** Total horizontal length of the route, metres. */
export const ROUTE_LENGTH_M: number = ROUTE_SEGMENTS.reduce(
  (sum, segment) => sum + segment.length,
  0,
);

/** Elevation at x = 0, metres above the sim datum (sea level-ish). */
export const ROUTE_START_ELEVATION_M = 0;

/** Returns the total horizontal length of the route in metres. */
export function getRouteLength(): number {
  return ROUTE_LENGTH_M;
}

/**
 * Returns the grade (slope ratio) at world position `x` metres.
 *
 * `x` is clamped to the route bounds: positions before the start use the first
 * segment's grade and positions at/after the end use the last segment's grade.
 * Segment boundaries resolve to the segment that *starts* at that boundary
 * (i.e. the boundary belongs to the following segment).
 */
export function getGradeAt(x: number): number {
  if (ROUTE_SEGMENTS.length === 0) {
    return 0;
  }
  const first = ROUTE_SEGMENTS[0];
  const last = ROUTE_SEGMENTS[ROUTE_SEGMENTS.length - 1];
  if (x <= first.startX) {
    return first.grade;
  }
  if (x >= last.startX + last.length) {
    return last.grade;
  }
  for (const segment of ROUTE_SEGMENTS) {
    if (x >= segment.startX && x < segment.startX + segment.length) {
      return segment.grade;
    }
  }
  // Unreachable given contiguous segments, but keep the fallback total.
  return last.grade;
}

/**
 * Returns the elevation (metres) at world position `x` metres, integrated from
 * the piecewise-constant grade profile starting at
 * {@link ROUTE_START_ELEVATION_M}.
 *
 * `x` is clamped to route bounds. Because grade is rise/run, the elevation
 * contribution of a stretch is `grade * horizontalDistance`.
 */
export function getElevationAt(x: number): number {
  if (ROUTE_SEGMENTS.length === 0) {
    return ROUTE_START_ELEVATION_M;
  }
  const clampedX = Math.max(0, Math.min(x, ROUTE_LENGTH_M));
  let elevation = ROUTE_START_ELEVATION_M;
  for (const segment of ROUTE_SEGMENTS) {
    const segmentEnd = segment.startX + segment.length;
    if (clampedX >= segmentEnd) {
      // Whole segment is behind us.
      elevation += segment.grade * segment.length;
    } else if (clampedX > segment.startX) {
      // Partial segment: add the covered portion, then stop.
      elevation += segment.grade * (clampedX - segment.startX);
      break;
    } else {
      // Segment is entirely ahead of us.
      break;
    }
  }
  return elevation;
}

/** Elevation at the finish (rescue summit), metres. */
export const ROUTE_FINISH_ELEVATION_M: number = getElevationAt(ROUTE_LENGTH_M);
