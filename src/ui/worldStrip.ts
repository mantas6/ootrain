/**
 * Pure helpers that derive strip/map geometry from the shared route data.
 *
 * These build a normalised elevation silhouette and station marker positions
 * for the ProgressStrip and MapScreen. They read only from the `game/data`
 * config modules (allowed shared config) — never from sim internals.
 */

import {
  ROUTE_LENGTH_M,
  ROUTE_SEGMENTS,
  STATIONS,
  getElevationAt,
} from "../game/data";
import { clamp01, positionToStripFraction } from "./format";

/** A point on the normalised elevation silhouette, both axes in 0..1. */
export interface SilhouettePoint {
  /** Horizontal fraction along the route, 0..1. */
  x: number;
  /** Elevation fraction, 0 (lowest) .. 1 (highest). */
  y: number;
}

/** A station marker placed along the strip. */
export interface StripStation {
  id: string;
  name: string;
  region: string;
  /** Horizontal fraction along the route, 0..1. */
  x: number;
  /** Elevation fraction at the station, 0..1. */
  y: number;
}

/**
 * Builds a normalised elevation silhouette by sampling the route at each
 * segment boundary (piecewise-linear grade means boundaries are enough). The
 * returned `y` is normalised so the lowest point maps to 0 and the highest to
 * 1; if the route is flat everything maps to 0.
 */
export function buildElevationSilhouette(): SilhouettePoint[] {
  const xs: number[] = [0];
  for (const seg of ROUTE_SEGMENTS) {
    xs.push(seg.startX + seg.length);
  }
  const samples = xs.map((x) => ({ x, elev: getElevationAt(x) }));
  const elevations = samples.map((s) => s.elev);
  const minE = Math.min(...elevations);
  const maxE = Math.max(...elevations);
  const range = maxE - minE;
  return samples.map((s) => ({
    x: positionToStripFraction(s.x, ROUTE_LENGTH_M),
    y: range > 0 ? clamp01((s.elev - minE) / range) : 0,
  }));
}

/** Builds the station markers with their horizontal + elevation fractions. */
export function buildStripStations(): StripStation[] {
  const elevations = STATIONS.map((st) => getElevationAt(st.positionX));
  const allElev = ROUTE_SEGMENTS.map((seg) =>
    getElevationAt(seg.startX + seg.length),
  ).concat(getElevationAt(0));
  const minE = Math.min(...allElev);
  const maxE = Math.max(...allElev);
  const range = maxE - minE;
  return STATIONS.map((st, i) => ({
    id: st.id,
    name: st.name,
    region: st.region,
    x: positionToStripFraction(st.positionX, ROUTE_LENGTH_M),
    y: range > 0 ? clamp01((elevations[i] - minE) / range) : 0,
  }));
}

/**
 * Converts a normalised silhouette into an SVG polyline `points` string for a
 * viewBox of `width` x `height`, where `y=1` (peak) sits near the top.
 * `topPad`/`bottomPad` reserve vertical space so the silhouette doesn't touch
 * the edges.
 */
export function silhouetteToPolyline(
  points: readonly SilhouettePoint[],
  width: number,
  height: number,
  topPad = 4,
  bottomPad = 4,
): string {
  const usable = height - topPad - bottomPad;
  return points
    .map((p) => {
      const px = p.x * width;
      const py = topPad + (1 - p.y) * usable;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
}
