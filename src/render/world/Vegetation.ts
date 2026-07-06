/**
 * Reusable vegetation prop factories: trees (live + burned), bushes, rocks.
 *
 * These return small `THREE.Group`s built from shared cached materials and
 * simple primitives. They are meant to be scattered by {@link TerrainTile}. A
 * `burned` flag switches live greens for charred blacks and bare canopies so a
 * tile behind the fire front can be re-flavoured without new geometry types.
 *
 * Geometries are created per-call but kept cheap; callers that scatter many of
 * one prop should prefer instancing where it matters (see CityProps power
 * poles). No GL context is required to build these.
 */

import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
} from "three";
import { PALETTE, paletteMaterial, stdMaterial } from "../palette";

/**
 * A conifer-style tree: a trunk with two stacked cone tiers. When `burned`, the
 * trunk is charred and the canopy becomes a sparse dark cone (bare tree).
 */
export function makeTree(burned = false): Group {
  const g = new Group();
  g.name = burned ? "tree-burned" : "tree";

  const trunkMat = paletteMaterial(burned ? "charTree" : "trunk", {
    roughness: 0.95,
  });
  const trunk = new Mesh(new CylinderGeometry(0.12, 0.18, 1.6, 6), trunkMat);
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  g.add(trunk);

  if (burned) {
    // A bare, blackened crown — a single ragged cone.
    const crown = new Mesh(
      new ConeGeometry(0.5, 1.4, 6),
      paletteMaterial("charTree", { roughness: 1 }),
    );
    crown.position.y = 1.9;
    crown.castShadow = true;
    g.add(crown);
  } else {
    const foliageMat = paletteMaterial("foliage", { roughness: 0.9 });
    const lower = new Mesh(new ConeGeometry(0.9, 1.6, 7), foliageMat);
    lower.position.y = 1.9;
    lower.castShadow = true;
    g.add(lower);
    const upper = new Mesh(
      new ConeGeometry(0.65, 1.3, 7),
      paletteMaterial("foliageDim", { roughness: 0.9 }),
    );
    upper.position.y = 2.7;
    upper.castShadow = true;
    g.add(upper);
  }
  return g;
}

/** A low rounded bush (or a scorched clump when burned). */
export function makeBush(burned = false): Group {
  const g = new Group();
  g.name = burned ? "bush-burned" : "bush";
  const mat = paletteMaterial(burned ? "charTree" : "bush", {
    roughness: 0.95,
  });
  for (let i = 0; i < 3; i++) {
    const lump = new Mesh(new SphereGeometry(0.35, 6, 5), mat);
    lump.position.set((i - 1) * 0.3, 0.3, (i % 2) * 0.2);
    lump.scale.y = 0.7;
    lump.castShadow = true;
    g.add(lump);
  }
  return g;
}

/** A grey rock / boulder cluster (unaffected by fire, just greyer variants). */
export function makeRock(): Group {
  const g = new Group();
  g.name = "rock";
  const mat = stdMaterial({
    color: PALETTE.rock,
    roughness: 1,
    metalness: 0.05,
    flatShading: true,
  });
  const darkMat = stdMaterial({
    color: PALETTE.rockDark,
    roughness: 1,
    metalness: 0.05,
    flatShading: true,
  });
  const main = new Mesh(new SphereGeometry(0.7, 5, 4), mat);
  main.position.y = 0.4;
  main.scale.set(1.2, 0.8, 1);
  main.castShadow = true;
  g.add(main);
  const small = new Mesh(new SphereGeometry(0.4, 5, 4), darkMat);
  small.position.set(0.7, 0.25, 0.3);
  small.scale.set(1, 0.7, 1);
  small.castShadow = true;
  g.add(small);
  return g;
}
