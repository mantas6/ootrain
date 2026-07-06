/**
 * Coupler link factory.
 *
 * A minimal drawbar + hook that visually bridges the gap between two adjacent
 * vehicles. Placed at the mid-point between vehicle ends and stretched to span
 * the gap. Kept deliberately simple — it reads as a dark mechanical link, not a
 * detailed knuckle coupler.
 */

import { BoxGeometry, Group, Mesh } from "three";
import { paletteMaterial } from "../palette";

/** A simple coupler link between two vehicles. */
export class Coupler {
  readonly group: Group;

  /**
   * @param frameY  Height of the coupler above the track (frame centre).
   * @param gap     Horizontal gap to span, metres.
   */
  constructor(frameY = 0.85, gap = 1.4) {
    this.group = new Group();
    this.group.name = "coupler";
    const mat = paletteMaterial("buffer", { roughness: 0.6, metalness: 0.6 });

    const bar = new Mesh(new BoxGeometry(gap, 0.16, 0.18), mat);
    bar.position.y = frameY;
    bar.castShadow = true;
    this.group.add(bar);

    // Two small pivot blocks at the ends.
    for (const x of [-gap / 2, gap / 2]) {
      const block = new Mesh(new BoxGeometry(0.22, 0.26, 0.28), mat);
      block.position.set(x, frameY, 0);
      this.group.add(block);
    }
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
}
