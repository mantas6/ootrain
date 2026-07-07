/**
 * A terrain tile: a ground strip that follows the elevation profile, plus a
 * deterministic scatter of region-flavoured decoration (vegetation, rocks,
 * buildings, poles).
 *
 * One tile maps 1:1 to a world chunk (same width/index as a track chunk). The
 * scatter is seeded from the chunk index so a tile looks identical every time
 * it streams in, and props are kept clear of the track corridor so the rails
 * stay readable (docs/05-camera-ui.md rule).
 *
 * A tile can be built as a `burned` variant (scorched ground colour, bare
 * trees, blackened buildings) — {@link WorldView} rebuilds a tile in the burned
 * variant once the fire front passes its X. No GL context is needed to build.
 */

import { BoxGeometry, Group, Mesh } from "three";
import { PALETTE, stdMaterial } from "../palette";
import { getElevationAt, getGradeAt } from "../../game/data";
import { scatterInChunk } from "../routeGeometry";
import { makeBush, makeRock, makeTree } from "./Vegetation";
import {
  makeCrateStack,
  makeFence,
  makeHouse,
  makePowerPoleLine,
  makeShed,
  makeSmokeStack,
} from "./CityProps";

/** Region flavour buckets that bias which props a tile scatters. */
export type RegionKind =
  "coast" | "town" | "yard" | "tunnel" | "mountain" | "summit";

/**
 * Picks a region flavour for a world X by rough position along the route. This
 * is a cheap heuristic (the sim doesn't expose regions); it produces distinct
 * looks for coast → town → yard → mountain → summit as the train climbs.
 */
export function regionForX(x: number, routeLength: number): RegionKind {
  const t = x / routeLength;
  if (t < 0.09) return "coast";
  if (t < 0.24) return "town";
  if (t < 0.4) return "yard";
  if (t < 0.55) return "tunnel";
  if (t < 0.88) return "mountain";
  return "summit";
}

/** Ground colour + scatter mix per region. */
interface RegionStyle {
  ground: number;
  /** Relative weights for [tree, bush, rock, house, shed, crates, stack]. */
  weights: number[];
  /** Decoration slots per tile. */
  density: number;
}

const REGION_STYLES: Record<RegionKind, RegionStyle> = {
  coast: { ground: PALETTE.sand, weights: [1, 2, 1, 3, 2, 3, 2], density: 7 },
  town: {
    ground: PALETTE.grassLive,
    weights: [2, 3, 1, 5, 3, 2, 1],
    density: 8,
  },
  yard: { ground: PALETTE.soil, weights: [1, 1, 1, 2, 4, 5, 3], density: 8 },
  tunnel: {
    ground: PALETTE.rockDark,
    weights: [1, 1, 4, 1, 2, 2, 1],
    density: 6,
  },
  // Forest belt: trees dominate the mix and the tile carries roughly triple
  // the decoration slots so the canopy reads as woodland, not scattered stragglers.
  mountain: {
    ground: PALETTE.grassDim,
    weights: [8, 3, 4, 2, 1, 1, 1],
    density: 16,
  },
  summit: { ground: PALETTE.rock, weights: [2, 2, 4, 3, 2, 1, 1], density: 6 },
};

/** Prop kinds in weight order (indices match {@link RegionStyle.weights}). */
type PropKind =
  "tree" | "bush" | "rock" | "house" | "shed" | "crates" | "stack";
const PROP_ORDER: PropKind[] = [
  "tree",
  "bush",
  "rock",
  "house",
  "shed",
  "crates",
  "stack",
];

/** Picks a prop kind from a 0..1 roll against the region's weights. */
function pickProp(roll: number, weights: number[]): PropKind {
  const total = weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  const target = roll * total;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (target <= acc) return PROP_ORDER[i];
  }
  return PROP_ORDER[PROP_ORDER.length - 1];
}

/** A streamable terrain tile. */
export class TerrainTile {
  readonly group: Group;
  readonly chunkIndex: number;
  readonly chunkSize: number;
  readonly burned: boolean;

  constructor(
    chunkIndex: number,
    chunkSize: number,
    routeLength: number,
    burned = false,
  ) {
    this.chunkIndex = chunkIndex;
    this.chunkSize = chunkSize;
    this.burned = burned;
    this.group = new Group();
    this.group.name = `terrain:${chunkIndex}${burned ? ":burned" : ""}`;

    const startX = chunkIndex * chunkSize;
    const region = regionForX(startX + chunkSize / 2, routeLength);
    const style = REGION_STYLES[region];

    this.buildGround(startX, chunkSize, style, burned);
    this.buildScatter(chunkIndex, chunkSize, style, burned);
    this.buildPowerLine(chunkIndex, chunkSize);
    if (!burned && (region === "town" || region === "yard")) {
      this.buildFences(chunkIndex, chunkSize);
    }
  }

  /** A couple of fence runs parallel to the track in settled regions. */
  private buildFences(chunkIndex: number, chunkSize: number): void {
    const startX = chunkIndex * chunkSize;
    for (const seg of [0.25, 0.7]) {
      const cx = startX + seg * chunkSize;
      const fence = makeFence(10);
      fence.rotation.y = Math.PI / 2; // run along X
      fence.position.set(cx, getElevationAt(cx) - 0.15, 12);
      this.group.add(fence);
    }
  }

  /** A ground strip of short pitched slabs following the elevation. */
  private buildGround(
    startX: number,
    length: number,
    style: RegionStyle,
    burned: boolean,
  ): void {
    const groundColor = burned ? PALETTE.ash : style.ground;
    const mat = stdMaterial({ color: groundColor, roughness: 1 });
    const step = 8;
    const depth = 90; // wide strip so the side view never sees an edge
    const geo = new BoxGeometry(step + 0.5, 1.2, depth);
    for (let x = startX; x < startX + length; x += step) {
      const cx = x + step / 2;
      const slab = new Mesh(geo, mat);
      // Sit the ground top just below the ballast.
      slab.position.set(cx, getElevationAt(cx) - 0.75, 0);
      slab.rotation.z = Math.atan(getGradeAt(cx));
      slab.receiveShadow = true;
      this.group.add(slab);
    }
  }

  /** Deterministic decoration scatter clear of the track corridor. */
  private buildScatter(
    chunkIndex: number,
    chunkSize: number,
    style: RegionStyle,
    burned: boolean,
  ): void {
    const items = scatterInChunk({
      chunkIndex,
      chunkSize,
      count: style.density,
      clearZ: 7,
      maxZ: 34,
    });
    for (const item of items) {
      const kind = pickProp(item.kind, style.weights);
      const prop = this.makeProp(kind, burned);
      if (!prop) continue;
      const y = getElevationAt(item.x) - 0.15;
      prop.position.set(item.x, y, item.z);
      prop.rotation.y = item.rotationY;
      prop.scale.setScalar(item.scale);
      this.group.add(prop);
    }
  }

  private makeProp(kind: PropKind, burned: boolean): Group | null {
    switch (kind) {
      case "tree":
        return makeTree(burned);
      case "bush":
        return makeBush(burned);
      case "rock":
        return makeRock();
      case "house":
        return makeHouse(burned);
      case "shed":
        return makeShed(burned);
      case "crates":
        return makeCrateStack();
      case "stack":
        return makeSmokeStack();
    }
  }

  /** A single instanced run of power poles on one side of the track. */
  private buildPowerLine(chunkIndex: number, chunkSize: number): void {
    const startX = chunkIndex * chunkSize;
    const poleGap = 28;
    const transforms: { x: number; z: number; scale: number }[] = [];
    for (let x = startX + 6; x < startX + chunkSize; x += poleGap) {
      transforms.push({ x, z: 9, scale: 1 });
    }
    if (transforms.length === 0) return;
    const line = makePowerPoleLine(transforms, (x) => getElevationAt(x) - 0.15);
    this.group.add(line);
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
}
