/**
 * Distant hill / mountain silhouettes for the summit region.
 *
 * The 2.5D camera looks along −Z at the X/Y plane, so anything at a large
 * negative Z sits far behind the track. This module places big, low-poly peaked
 * mounds back there in two depth rows to give the last stretch a mountainous
 * horizon; the scene fog (see {@link scene}) fades them into haze so they read
 * as a ridge line rather than solid geometry.
 *
 * Placement is split into a pure, deterministic planner ({@link planBackgroundHills})
 * — cheap to unit test with no Three.js — and a tiny factory ({@link makeHill})
 * that builds one unit hill the caller scales/positions. No GL context needed.
 */

import { ConeGeometry, Group, Mesh } from "three";
import { PALETTE, stdMaterial } from "../palette";
import { hashSeed, seededRandom } from "../routeGeometry";

/** A planned background hill (world X/Z, size, snow flag, depth row). */
export interface HillPlacement {
  /** World X of the hill centre. */
  x: number;
  /** World Z (negative = behind the track). */
  z: number;
  /** Base width, metres. */
  width: number;
  /** Peak height above its base, metres. */
  height: number;
  /** Whether the peak carries a snow cap. */
  snow: boolean;
  /** True for the far, hazier ridge; false for the nearer ridge. */
  far: boolean;
}

interface HillRow {
  z: number;
  zJitter: number;
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
  count: number;
  far: boolean;
  snowAbove: number;
}

/** Two depth rows: a distant hazy range and a nearer, lower ridge. */
const HILL_ROWS: HillRow[] = [
  {
    z: -260,
    zJitter: 60,
    minW: 130,
    maxW: 220,
    minH: 60,
    maxH: 120,
    count: 3,
    far: true,
    snowAbove: 90,
  },
  {
    z: -150,
    zJitter: 40,
    minW: 80,
    maxW: 150,
    minH: 34,
    maxH: 74,
    count: 4,
    far: false,
    snowAbove: 58,
  },
];

/**
 * Deterministically plans the background hills for one chunk. Identical inputs
 * always yield an identical layout (seeded per chunk), so hills don't shimmer
 * as tiles stream in and out. Hills are allowed to spill slightly past the
 * chunk edges so adjacent chunks overlap into a continuous ridge line.
 */
export function planBackgroundHills(params: {
  chunkIndex: number;
  chunkSize: number;
  seedSalt?: number;
}): HillPlacement[] {
  const { chunkIndex, chunkSize } = params;
  const salt = params.seedSalt ?? 0x8111;
  const startX = chunkIndex * chunkSize;
  const rand = seededRandom(hashSeed(chunkIndex, salt));
  const out: HillPlacement[] = [];
  for (const row of HILL_ROWS) {
    for (let i = 0; i < row.count; i++) {
      const t = (i + rand() * 0.85) / row.count;
      const x = startX + t * chunkSize;
      const width = row.minW + rand() * (row.maxW - row.minW);
      const height = row.minH + rand() * (row.maxH - row.minH);
      const z = row.z - rand() * row.zJitter;
      out.push({
        x,
        z,
        width,
        height,
        snow: height > row.snowAbove,
        far: row.far,
      });
    }
  }
  return out;
}

/**
 * Builds one unit hill: a faceted peaked cone (base spanning y 0..1, footprint
 * ±1 in X/Z) with an optional snow cap. The caller scales it to
 * `(width/2, height, width/2)` and drops its base onto the ground. `far` picks
 * the hazier distant colour. Background only — casts/receives no shadows.
 */
export function makeHill(snow: boolean, far: boolean): Group {
  const g = new Group();
  g.name = far ? "hill-far" : "hill-near";

  const bodyMat = stdMaterial({
    color: far ? PALETTE.hillFar : PALETTE.hillNear,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const body = new Mesh(new ConeGeometry(1, 1, 6, 1), bodyMat);
  body.position.y = 0.5; // base at y=0, apex at y=1
  g.add(body);

  if (snow) {
    const capMat = stdMaterial({
      color: PALETTE.snow,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    const cap = new Mesh(new ConeGeometry(0.42, 0.4, 6, 1), capMat);
    cap.position.y = 0.8; // near the apex
    g.add(cap);
  }
  return g;
}
