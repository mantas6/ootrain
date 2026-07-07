/**
 * Rugged foreground scenery for the summit / climb region: faceted boulders,
 * craggy rock outcrops, and low grass-and-rock hummocks.
 *
 * These are meant to be scattered by {@link TerrainTile} near the track in the
 * highest region so the last stretch reads as rocky and hilly rather than the
 * flat, settled ground of the lowlands. All built from low-poly faceted
 * primitives (Icosahedron/Dodecahedron/Cone with flat shading) and shared
 * cached materials from {@link palette}. Fire-agnostic (bare rock/earth), so
 * no `burned` variant is needed. No GL context is required to build these.
 */

import {
  ConeGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
} from "three";
import { PALETTE, stdMaterial } from "../palette";

function rockMat(color: number) {
  return stdMaterial({
    color,
    roughness: 1,
    metalness: 0.05,
    flatShading: true,
  });
}

/**
 * A single faceted boulder with a smaller companion stone — a chunky low-poly
 * rock roughly 1.2 m across, tuned for scatter near the rails.
 */
export function makeBoulder(): Group {
  const g = new Group();
  g.name = "boulder";

  const main = new Mesh(new IcosahedronGeometry(0.9, 0), rockMat(PALETTE.rock));
  main.position.y = 0.6;
  main.scale.set(1.3, 0.9, 1.1);
  main.castShadow = true;
  main.receiveShadow = true;
  g.add(main);

  const small = new Mesh(
    new IcosahedronGeometry(0.5, 0),
    rockMat(PALETTE.rockDark),
  );
  small.position.set(0.9, 0.3, 0.4);
  small.castShadow = true;
  g.add(small);
  return g;
}

/**
 * A craggy rock outcrop: a squat faceted base with a couple of jagged spires,
 * ~3 m tall. Gives the summit its rugged, exposed-bedrock silhouette.
 */
export function makeOutcrop(): Group {
  const g = new Group();
  g.name = "outcrop";

  const base = new Mesh(
    new DodecahedronGeometry(1.2, 0),
    rockMat(PALETTE.rockDark),
  );
  base.position.y = 0.5;
  base.scale.set(1.4, 0.7, 1.2);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const spire = new Mesh(
    new ConeGeometry(0.8, 3.2, 5, 1),
    rockMat(PALETTE.rock),
  );
  spire.position.set(0.1, 2.0, 0);
  spire.rotation.z = 0.12;
  spire.castShadow = true;
  g.add(spire);

  const spike = new Mesh(
    new ConeGeometry(0.55, 2.0, 5, 1),
    rockMat(PALETTE.scree),
  );
  spike.position.set(-0.9, 1.3, 0.3);
  spike.rotation.z = -0.18;
  spike.castShadow = true;
  g.add(spike);
  return g;
}

/**
 * A low, wide grass-and-rock hummock — a rounded mound of terrain with a rock
 * poking through. Placed terrain-side to break up flat ground into rolling,
 * hilly relief.
 */
export function makeHummock(): Group {
  const g = new Group();
  g.name = "hummock";

  const mound = new Mesh(
    new IcosahedronGeometry(1.6, 0),
    stdMaterial({ color: PALETTE.grassDim, roughness: 1, flatShading: true }),
  );
  mound.position.y = 0.2;
  mound.scale.set(1.6, 0.5, 1.4);
  mound.castShadow = true;
  mound.receiveShadow = true;
  g.add(mound);

  const rock = new Mesh(new IcosahedronGeometry(0.5, 0), rockMat(PALETTE.rock));
  rock.position.set(0.6, 0.5, 0.2);
  rock.scale.set(1, 0.8, 1);
  rock.castShadow = true;
  g.add(rock);
  return g;
}
