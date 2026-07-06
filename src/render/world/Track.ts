/**
 * Visible track: two rails, sleepers, and a ballast bed following the route
 * elevation profile, built one chunk at a time.
 *
 * A {@link TrackChunk} covers `[startX, startX + length]` and samples the route
 * elevation at a fixed step to lay sleepers and ballast that hug the hills. The
 * two rails are rendered as one instanced sleeper set plus long thin rail boxes
 * per sub-segment so the rail line stays readable (the brief's priority) without
 * a draw call per sleeper.
 *
 * Chunks are created/disposed by {@link WorldView} as the train advances. No GL
 * context is needed to build a chunk.
 */

import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from "three";
import { paletteMaterial } from "../palette";
import { getElevationAt, getGradeAt } from "../../game/data";

/** Half the rail gauge (distance of each rail from centre), metres. */
const HALF_GAUGE = 0.75;
/** Spacing between sleepers, metres. */
const SLEEPER_SPACING = 1.4;
/** Height of the railhead above the sleeper top, metres. */
const RAIL_LIFT = 0.12;

/** One streamable chunk of track. */
export class TrackChunk {
  readonly group: Group;
  readonly startX: number;
  readonly length: number;

  constructor(startX: number, length: number) {
    this.startX = startX;
    this.length = length;
    this.group = new Group();
    this.group.name = `track:${startX}`;

    this.buildBallast();
    this.buildSleepers();
    this.buildRails();
  }

  /** A continuous ballast bed as a series of short pitched slabs. */
  private buildBallast(): void {
    const mat = paletteMaterial("ballast", { roughness: 1 });
    const step = 6;
    const geo = new BoxGeometry(step + 0.2, 0.24, 2.6);
    for (let x = this.startX; x < this.startX + this.length; x += step) {
      const cx = x + step / 2;
      const slab = new Mesh(geo, mat);
      slab.position.set(cx, getElevationAt(cx) - 0.12, 0);
      slab.rotation.z = Math.atan(getGradeAt(cx));
      slab.receiveShadow = true;
      this.group.add(slab);
    }
  }

  /** Sleepers as a single instanced mesh (one draw call for the chunk). */
  private buildSleepers(): void {
    const count = Math.max(1, Math.floor(this.length / SLEEPER_SPACING));
    const geo = new BoxGeometry(0.24, 0.14, 2.2);
    const mat = paletteMaterial("sleeper", { roughness: 1 });
    const mesh = new InstancedMesh(geo, mat, count);
    mesh.receiveShadow = true;

    const m = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scl = new Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      const x = this.startX + (i + 0.5) * SLEEPER_SPACING;
      pos.set(x, getElevationAt(x) + 0.02, 0);
      quat.setFromAxisAngle(new Vector3(0, 0, 1), Math.atan(getGradeAt(x)));
      m.compose(pos, quat, scl);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  /** Two rails, each a run of short pitched boxes tracing the elevation. */
  private buildRails(): void {
    const mat = paletteMaterial("rail", { roughness: 0.4, metalness: 0.7 });
    const step = 4;
    const geo = new BoxGeometry(step + 0.05, 0.12, 0.1);
    for (let x = this.startX; x < this.startX + this.length; x += step) {
      const cx = x + step / 2;
      const y = getElevationAt(cx) + RAIL_LIFT;
      const pitch = Math.atan(getGradeAt(cx));
      for (const z of [-HALF_GAUGE, HALF_GAUGE]) {
        const rail = new Mesh(geo, mat);
        rail.position.set(cx, y, z);
        rail.rotation.z = pitch;
        rail.castShadow = true;
        this.group.add(rail);
      }
    }
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
}
