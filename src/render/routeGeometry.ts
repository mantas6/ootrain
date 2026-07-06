/**
 * Pure geometry helpers that bridge the simulation's route data to world-space
 * placement for the renderer.
 *
 * Coordinate convention (per the brief): route X = world X (metres), elevation
 * = world Y, track centreline at world Z = 0, the camera looks along −Z at the
 * X/Y plane (2.5D side view). All functions here are pure and free of Three.js
 * so they are cheap to unit test and safe to import anywhere.
 */

import { getElevationAt, getGradeAt } from "../game/data";

/** A 3D position in world space. */
export interface WorldPos {
  x: number;
  y: number;
  z: number;
}

/**
 * Returns the world position of the track centreline at route position `x`.
 * `z` is always 0 (the route runs along the X axis); `y` is the route
 * elevation. A vertical `lift` can be added (e.g. to sit a vehicle body above
 * the rail).
 */
export function trackPointAt(x: number, lift = 0): WorldPos {
  return { x, y: getElevationAt(x) + lift, z: 0 };
}

/**
 * Returns the pitch angle (radians) of the track at route position `x`, derived
 * from the local grade. A positive grade (uphill in +X) yields a positive
 * rotation about the world Z axis so a body rotated by this angle noses upward.
 *
 * pitch = atan(grade). Rotating a vehicle whose length lies along +X by this
 * angle about +Z tilts its nose up on climbs and down on descents.
 */
export function trackPitchAt(x: number): number {
  return Math.atan(getGradeAt(x));
}

// --- Chunk math ------------------------------------------------------------
// The world is streamed in fixed-width chunks along X. These helpers are pure
// integer/coordinate math so the streaming logic in WorldView is testable
// without a GL context.

/** Returns the chunk index that contains route position `x`. */
export function chunkIndexAt(x: number, chunkSize: number): number {
  return Math.floor(x / chunkSize);
}

/** Returns the world X where chunk `index` starts. */
export function chunkStartX(index: number, chunkSize: number): number {
  return index * chunkSize;
}

/**
 * Returns the inclusive `[min, max]` chunk indices that should be resident for
 * a camera/train centred at `centerX`, keeping `radiusChunks` chunks on each
 * side. Indices are clamped to `[0, maxIndex]` so we never stream chunks before
 * the start or past the end of the route.
 */
export function visibleChunkRange(
  centerX: number,
  chunkSize: number,
  radiusChunks: number,
  routeLength: number,
): { min: number; max: number } {
  const center = chunkIndexAt(centerX, chunkSize);
  const lastIndex = Math.max(0, chunkIndexAt(routeLength, chunkSize));
  const min = Math.max(0, center - radiusChunks);
  const max = Math.min(lastIndex, center + radiusChunks);
  return { min, max };
}

// --- Deterministic scatter -------------------------------------------------
// Decoration placement must be deterministic (same seed → same world) so tiles
// look identical each time they stream in and out. We use a tiny integer hash
// PRNG seeded per (chunk, slot) rather than Math.random.

/**
 * A small deterministic hash → [0,1) generator (mulberry32-style). Given the
 * same integer seed it always returns the same sequence, so scatter placement
 * is stable across tile create/dispose cycles.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Combines two integers into one 32-bit seed (order-sensitive). */
export function hashSeed(a: number, b: number): number {
  let h = (a | 0) * 0x9e3779b1;
  h = (h ^ (b | 0)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return h >>> 0;
}

/** A single scattered decoration placement produced by {@link scatterInChunk}. */
export interface ScatterItem {
  /** World X of the item. */
  x: number;
  /** Signed Z offset from the track (kept clear of the rail corridor). */
  z: number;
  /** Uniform-ish scale factor, ~0.7..1.4. */
  scale: number;
  /** Rotation about Y, radians. */
  rotationY: number;
  /** A stable 0..1 "kind roll" the caller can bucket into prop types. */
  kind: number;
}

/**
 * Deterministically scatters `count` decoration slots across a chunk.
 *
 * Items are pushed away from the track corridor (|z| >= `clearZ`) on a
 * seeded-random side so the rails stay readable (TODO.md rule). The result is a
 * pure function of `(chunkIndex, count, chunkSize, clearZ, maxZ, seedSalt)`, so
 * identical inputs always yield an identical layout.
 */
export function scatterInChunk(params: {
  chunkIndex: number;
  chunkSize: number;
  count: number;
  clearZ: number;
  maxZ: number;
  seedSalt?: number;
}): ScatterItem[] {
  const { chunkIndex, chunkSize, count, clearZ, maxZ } = params;
  const salt = params.seedSalt ?? 0;
  const startX = chunkStartX(chunkIndex, chunkSize);
  const rand = seededRandom(hashSeed(chunkIndex, salt + 0x51ed));
  const items: ScatterItem[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + rand() * 0.9) / count;
    const x = startX + t * chunkSize;
    const side = rand() < 0.5 ? -1 : 1;
    const z = side * (clearZ + rand() * (maxZ - clearZ));
    const scale = 0.7 + rand() * 0.7;
    const rotationY = rand() * Math.PI * 2;
    const kind = rand();
    items.push({ x, z, scale, rotationY, kind });
  }
  return items;
}
