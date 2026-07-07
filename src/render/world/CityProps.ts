/**
 * Reusable settlement / industrial prop factories.
 *
 * Houses, sheds, power poles, crates, fences, and smoke stacks that dress the
 * world around the track so it feels lived-in (docs/05-camera-ui.md terrain-detail rules).
 * All built from primitives with shared cached materials. A `burned` flag on
 * buildings swaps to scorched/collapsed colours.
 *
 * Where a prop is scattered in large numbers along a chunk (power poles,
 * fences), a helper is provided that builds an {@link InstancedMesh} so the
 * whole run of props is one draw call. No GL context is required to build any
 * of these (InstancedMesh is a CPU object until rendered).
 */

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from "three";
import { PALETTE, paletteMaterial, stdMaterial } from "../palette";

/** A small pitched-roof house. `burned` scorches the walls + darkens the roof. */
export function makeHouse(burned = false): Group {
  const g = new Group();
  g.name = burned ? "house-burned" : "house";
  const wallMat = paletteMaterial(burned ? "ashLight" : "buildingWarm", {
    roughness: 0.9,
  });
  const roofMat = paletteMaterial(burned ? "roofDark" : "roof", {
    roughness: 0.85,
  });

  const w = 3;
  const h = 2.2;
  const d = 3.2;
  const body = new Mesh(new BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Ridge roof from a stretched cone (4 sides).
  const roof = new Mesh(new ConeGeometry(w * 0.85, 1.4, 4), roofMat);
  roof.position.y = h + 0.7;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = d / (w * 0.85 * Math.SQRT2 * 0.85);
  roof.castShadow = true;
  g.add(roof);

  if (!burned) {
    // A couple of dark windows for readability.
    const winMat = paletteMaterial("window", { roughness: 0.3 });
    for (const x of [-0.7, 0.7]) {
      const win = new Mesh(new BoxGeometry(0.6, 0.7, 0.06), winMat);
      win.position.set(x, h * 0.55, d / 2 + 0.01);
      g.add(win);
    }
  }
  return g;
}

/** A flat-roof storage shed / workshop. */
export function makeShed(burned = false): Group {
  const g = new Group();
  g.name = burned ? "shed-burned" : "shed";
  const mat = paletteMaterial(burned ? "ashLight" : "shed", {
    roughness: 0.92,
  });
  const w = 4;
  const h = 2.4;
  const d = 3;
  const body = new Mesh(new BoxGeometry(w, h, d), mat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Corrugated-look roof: a slightly wider dark slab.
  const roof = new Mesh(
    new BoxGeometry(w + 0.3, 0.2, d + 0.3),
    paletteMaterial("roofDark", { roughness: 0.8, metalness: 0.3 }),
  );
  roof.position.y = h + 0.1;
  roof.castShadow = true;
  g.add(roof);
  return g;
}

/** A tall industrial smoke stack (chimney). */
export function makeSmokeStack(): Group {
  const g = new Group();
  g.name = "smokestack";
  const mat = paletteMaterial("building", { roughness: 0.95 });
  const stack = new Mesh(new CylinderGeometry(0.5, 0.7, 8, 12), mat);
  stack.position.y = 4;
  stack.castShadow = true;
  g.add(stack);
  // A red band near the top.
  const band = new Mesh(
    new CylinderGeometry(0.52, 0.52, 0.8, 12),
    stdMaterial({ color: PALETTE.loco2Body, roughness: 0.8 }),
  );
  band.position.y = 7;
  g.add(band);
  return g;
}

/** A stack of shipping crates. */
export function makeCrateStack(): Group {
  const g = new Group();
  g.name = "crates";
  const mat = paletteMaterial("crate", { roughness: 0.92 });
  const positions = [
    { x: 0, y: 0.5, s: 1 },
    { x: 1.1, y: 0.5, s: 0.9 },
    { x: 0.5, y: 1.5, s: 0.85 },
  ];
  for (const p of positions) {
    const crate = new Mesh(new BoxGeometry(p.s, p.s, p.s), mat);
    crate.position.set(p.x, p.y, 0);
    crate.castShadow = true;
    g.add(crate);
  }
  return g;
}

/**
 * A run of fence posts + rails as a single group. Cheap enough as plain meshes
 * for the modest counts used per tile.
 */
export function makeFence(length = 6): Group {
  const g = new Group();
  g.name = "fence";
  const mat = paletteMaterial("woodPlank", { roughness: 0.95 });
  const posts = Math.max(2, Math.round(length / 1.5));
  for (let i = 0; i <= posts; i++) {
    const post = new Mesh(new BoxGeometry(0.1, 1, 0.1), mat);
    post.position.set((i / posts - 0.5) * length, 0.5, 0);
    g.add(post);
  }
  for (const y of [0.4, 0.8]) {
    const rail = new Mesh(new BoxGeometry(length, 0.08, 0.06), mat);
    rail.position.set(0, y, 0);
    g.add(rail);
  }
  return g;
}

/** A single power pole with a crossarm. */
export function makePowerPole(): Group {
  const g = new Group();
  g.name = "power-pole";
  const mat = paletteMaterial("metalPole", { roughness: 0.9 });
  const pole = new Mesh(new CylinderGeometry(0.1, 0.13, 6, 6), mat);
  pole.position.y = 3;
  pole.castShadow = true;
  g.add(pole);
  const arm = new Mesh(new BoxGeometry(1.6, 0.12, 0.12), mat);
  arm.position.y = 5.4;
  g.add(arm);
  return g;
}

/**
 * Builds an {@link InstancedMesh} of simple power poles at the given world
 * transforms — one draw call for a whole line of poles along a chunk. Returns
 * the instanced pole shaft; a matching crossarm instanced mesh is added as a
 * child so the pair moves together.
 *
 * `transforms` are `{ x, z, scale }`; y is derived by the caller's elevation
 * function passed as `elevationAt`.
 */
export function makePowerPoleLine(
  transforms: { x: number; z: number; scale: number }[],
  elevationAt: (x: number) => number,
): Group {
  const g = new Group();
  g.name = "power-pole-line";
  const count = transforms.length;
  if (count === 0) return g;

  const mat = paletteMaterial("metalPole", { roughness: 0.9 });
  const poleGeo = new CylinderGeometry(0.1, 0.13, 6, 6);
  const armGeo = new BoxGeometry(1.6, 0.12, 0.12);
  const poles = new InstancedMesh(poleGeo, mat, count);
  const arms = new InstancedMesh(armGeo, mat, count);
  poles.castShadow = true;

  const m = new Matrix4();
  const pos = new Vector3();
  const quat = new Quaternion();
  const scl = new Vector3();
  for (let i = 0; i < count; i++) {
    const t = transforms[i];
    const y = elevationAt(t.x);
    pos.set(t.x, y + 3 * t.scale, t.z);
    scl.set(t.scale, t.scale, t.scale);
    m.compose(pos, quat, scl);
    poles.setMatrixAt(i, m);
    pos.set(t.x, y + 5.4 * t.scale, t.z);
    m.compose(pos, quat, scl);
    arms.setMatrixAt(i, m);
  }
  poles.instanceMatrix.needsUpdate = true;
  arms.instanceMatrix.needsUpdate = true;
  g.add(poles);
  g.add(arms);
  return g;
}
