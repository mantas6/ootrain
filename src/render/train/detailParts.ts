/**
 * Small reusable vehicle detail parts (buffers, ladders, handrails).
 *
 * These are the fiddly bits that make a loco or wagon read as mechanical rather
 * than a plain box. They are plain factory functions that append meshes to a
 * parent group at the given local coordinates, using shared cached materials.
 * No GL context is required.
 */

import { BoxGeometry, CylinderGeometry, Group, Mesh } from "three";
import { paletteMaterial } from "../palette";

/**
 * Adds a buffer beam with two round buffer heads at one end of a vehicle.
 * `endX` is the local X of the end face; `frameY` the frame centre height;
 * `bodyWidth` the body width (buffers sit near the corners).
 */
export function addBuffers(
  parent: Group,
  endX: number,
  frameY: number,
  bodyWidth: number,
): void {
  const dir = Math.sign(endX) || 1;
  const beamMat = paletteMaterial("chassis", {
    roughness: 0.8,
    metalness: 0.3,
  });
  const bufMat = paletteMaterial("buffer", { roughness: 0.5, metalness: 0.6 });

  const beam = new Mesh(new BoxGeometry(0.2, 0.5, bodyWidth + 0.3), beamMat);
  beam.position.set(endX + dir * 0.1, frameY, 0);
  parent.add(beam);

  for (const z of [-1, 1]) {
    const head = new Mesh(new CylinderGeometry(0.16, 0.16, 0.3, 10), bufMat);
    head.rotation.z = Math.PI / 2;
    head.position.set(endX + dir * 0.35, frameY, z * (bodyWidth / 2 - 0.1));
    parent.add(head);
  }
}

/**
 * Adds a short access ladder standing vertically at a corner. `x`/`z` place its
 * base; `baseY` is the ground/frame foot; `height` the ladder height.
 */
export function addLadder(
  parent: Group,
  x: number,
  baseY: number,
  z: number,
  height: number,
): void {
  const mat = paletteMaterial("metalMid", { roughness: 0.5, metalness: 0.6 });
  const ladder = new Group();
  // Two stiles.
  for (const dx of [-0.14, 0.14]) {
    const stile = new Mesh(new BoxGeometry(0.04, height, 0.04), mat);
    stile.position.set(dx, height / 2, 0);
    ladder.add(stile);
  }
  // Rungs.
  const rungs = Math.max(3, Math.round(height / 0.35));
  for (let i = 0; i < rungs; i++) {
    const rung = new Mesh(new BoxGeometry(0.3, 0.03, 0.03), mat);
    rung.position.set(0, (i + 0.5) * (height / rungs), 0);
    ladder.add(rung);
  }
  ladder.position.set(x, baseY, z);
  parent.add(ladder);
}

/**
 * Adds a horizontal handrail running along X at a given side. `centerX` is its
 * midpoint, `y` the rail height, `z` the side offset, `length` its span.
 */
export function addHandrail(
  parent: Group,
  centerX: number,
  y: number,
  z: number,
  length: number,
): void {
  const mat = paletteMaterial("handrail", { roughness: 0.5, metalness: 0.5 });
  const rail = new Mesh(new CylinderGeometry(0.03, 0.03, length, 6), mat);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(centerX, y, z);
  parent.add(rail);

  // A couple of stanchions holding the rail off the body.
  for (const t of [-0.4, 0, 0.4]) {
    const post = new Mesh(new CylinderGeometry(0.02, 0.02, 0.18, 5), mat);
    post.position.set(centerX + t * length, y - 0.09, z);
    parent.add(post);
  }
}
