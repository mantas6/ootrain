/**
 * Wheel spark particles.
 *
 * A fixed pool of tiny additive points that burst outward and fall under a
 * little gravity, emitted while the wheels slip or the train brakes hard. Uses
 * a single {@link Points} object with a preallocated position buffer, so the
 * hot loop only writes into typed arrays (no allocations).
 *
 * The emitter position (near the driving wheels' rail contact) is set by the
 * caller each frame in world space.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Points,
  PointsMaterial,
  Vector3,
} from "three";
import { PALETTE } from "../palette";

const MAX_SPARKS = 60;
const GRAVITY = -14;

/** Wheel / brake spark particle system. */
export class Sparks {
  readonly group: Group;
  private readonly points: Points;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly ages: Float32Array;
  private readonly lives: Float32Array;
  private readonly geometry: BufferGeometry;
  private readonly material: PointsMaterial;
  private readonly emitPos = new Vector3();
  private emitAccumulator = 0;

  constructor() {
    this.group = new Group();
    this.group.name = "sparks";

    this.positions = new Float32Array(MAX_SPARKS * 3);
    this.velocities = new Float32Array(MAX_SPARKS * 3);
    this.ages = new Float32Array(MAX_SPARKS);
    this.lives = new Float32Array(MAX_SPARKS);
    // Start all sparks "dead" (past their life) and off-screen.
    for (let i = 0; i < MAX_SPARKS; i++) {
      this.ages[i] = 1;
      this.lives[i] = 1;
      this.positions[i * 3 + 1] = -9999;
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(this.positions, 3),
    );
    this.material = new PointsMaterial({
      color: PALETTE.spark,
      size: 0.28,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  /** Sets the world-space emission point (wheel rail contact). */
  setEmitPosition(x: number, y: number, z: number): void {
    this.emitPos.set(x, y, z);
  }

  private spawn(): void {
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (this.ages[i] < this.lives[i]) continue; // still alive
      this.ages[i] = 0;
      this.lives[i] = 0.25 + Math.random() * 0.35;
      const i3 = i * 3;
      this.positions[i3] = this.emitPos.x;
      this.positions[i3 + 1] = this.emitPos.y;
      this.positions[i3 + 2] = this.emitPos.z + (Math.random() - 0.5) * 0.8;
      // Spray mostly backward/up from the contact point.
      this.velocities[i3] = -3 - Math.random() * 4;
      this.velocities[i3 + 1] = 2 + Math.random() * 4;
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 3;
      return;
    }
  }

  /**
   * Advances the sparks. `intensity` (0..1) scales the emission rate; pass 0 to
   * stop emitting (existing sparks still finish their lives). `dt` seconds.
   */
  update(intensity: number, dt: number): void {
    if (intensity > 0) {
      const rate = intensity * 90;
      this.emitAccumulator += rate * dt;
      while (this.emitAccumulator >= 1) {
        this.emitAccumulator -= 1;
        this.spawn();
      }
    }

    const pos = this.positions;
    const vel = this.velocities;
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (this.ages[i] >= this.lives[i]) continue;
      this.ages[i] += dt;
      const i3 = i * 3;
      vel[i3 + 1] += GRAVITY * dt;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      if (this.ages[i] >= this.lives[i]) {
        pos[i3 + 1] = -9999; // park dead sparks below the world
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
