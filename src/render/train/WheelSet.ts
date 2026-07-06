/**
 * Driving-wheelset factory.
 *
 * A wheelset is a pair of wheels on a shared axle, plus (for driving wheels) a
 * visible crank pin so rotation reads clearly. The group is built once and
 * spun each frame by {@link WheelSet.update}, which advances the roll angle
 * from ground speed and over-rotates during wheel slip so the player can see
 * the wheels spinning faster than the train is moving (TODO.md traction cue).
 *
 * Wheels are laid across Z (the axle runs left↔right in the side view) and roll
 * about that Z axis as the train moves along X.
 */

import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from "three";
import { PALETTE, paletteMaterial } from "../palette";

/** Options controlling a wheelset's size and look. */
export interface WheelSetOptions {
  /** Wheel radius, metres. */
  radius?: number;
  /** Half-gauge: distance of each wheel from centre along Z, metres. */
  halfGauge?: number;
  /** Wheel tread width, metres. */
  width?: number;
  /** Show a crank pin (driving wheel). */
  driven?: boolean;
}

/** A wheelset instance: a group plus a per-frame update. */
export class WheelSet {
  readonly group: Group;
  private readonly axleGroup: Group;
  private readonly radius: number;
  private rollAngle = 0;

  constructor(opts: WheelSetOptions = {}) {
    const radius = opts.radius ?? 0.55;
    const halfGauge = opts.halfGauge ?? 0.7;
    const width = opts.width ?? 0.16;
    const driven = opts.driven ?? true;
    this.radius = radius;

    this.group = new Group();
    this.group.name = "wheelset";
    // The axle group is what actually rotates; wheels are children of it.
    this.axleGroup = new Group();
    this.group.add(this.axleGroup);

    const wheelMat = paletteMaterial("wheel", {
      roughness: 0.7,
      metalness: 0.4,
    });
    const rimMat = paletteMaterial("wheelRim", {
      roughness: 0.5,
      metalness: 0.6,
    });

    const wheelGeo = new CylinderGeometry(radius, radius, width, 20);
    for (const side of [-1, 1]) {
      const wheel = new Mesh(wheelGeo, wheelMat);
      // Cylinder axis is Y; rotate so it lies along Z (the axle direction).
      wheel.rotation.x = Math.PI / 2;
      wheel.position.z = side * halfGauge;
      wheel.castShadow = true;
      this.axleGroup.add(wheel);

      // A thin bright rim to catch light and read rotation.
      const rim = new Mesh(
        new TorusGeometry(radius * 0.98, 0.03, 6, 20),
        rimMat,
      );
      rim.position.z = side * halfGauge + side * width * 0.5;
      this.axleGroup.add(rim);

      if (driven) {
        // Crank pin offset from the hub so rolling is visible even head-on.
        const pin = new Mesh(
          new CylinderGeometry(0.05, 0.05, width * 0.6, 8),
          rimMat,
        );
        pin.rotation.x = Math.PI / 2;
        pin.position.set(radius * 0.55, 0, side * halfGauge);
        this.axleGroup.add(pin);
      }
    }

    // The axle rod itself.
    const axle = new Mesh(
      new CylinderGeometry(0.07, 0.07, halfGauge * 2 + width, 10),
      new MeshStandardMaterial({
        color: PALETTE.metalDark,
        roughness: 0.6,
        metalness: 0.5,
      }),
    );
    axle.rotation.x = Math.PI / 2;
    this.axleGroup.add(axle);
  }

  /**
   * Advances wheel rotation. `groundSpeed` is signed m/s (train forward speed);
   * `slipRatio` (>= 1 while slipping) makes the wheels over-spin. `dt` is
   * seconds. Rolling angle = distance / radius; slip multiplies the apparent
   * surface speed so wheels visibly outrun the ground.
   */
  update(groundSpeed: number, slipRatio: number, dt: number): void {
    const slipFactor = slipRatio > 1 ? slipRatio : 1;
    const surfaceSpeed = groundSpeed * slipFactor;
    // Rolling about +Z with forward motion means a negative angular delta.
    this.rollAngle -= (surfaceSpeed / this.radius) * dt;
    this.axleGroup.rotation.z = this.rollAngle;
  }
}
