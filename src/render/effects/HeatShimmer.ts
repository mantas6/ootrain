/**
 * Cheap heat effect above the engine at high temperature.
 *
 * Rather than a real refraction/distortion pass (expensive), this fakes heat
 * with a few faint additive planes that wobble and vary in opacity, plus a warm
 * emissive tint that grows as the engine approaches critical. It reads as
 * rising heat haze above the hood without any post-processing.
 *
 * Intensity is driven 0..1 by the caller from the temperature state/value. The
 * effect is fully hidden at low intensity so it costs nothing when the engine
 * is cool.
 */

import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import { PALETTE } from "../palette";

interface ShimmerPlane {
  mesh: Mesh;
  material: MeshBasicMaterial;
  phase: number;
  baseX: number;
}

const PLANE_COUNT = 3;

/** Heat-shimmer effect group (positioned above the engine by the caller). */
export class HeatShimmer {
  readonly group: Group;
  private readonly planes: ShimmerPlane[] = [];
  private readonly geo: PlaneGeometry;
  private time = 0;
  private readonly heatColor = new Color(PALETTE.heat);

  constructor(width = 4, height = 2.5) {
    this.group = new Group();
    this.group.name = "heatShimmer";
    this.group.visible = false;
    this.geo = new PlaneGeometry(width, height);
    for (let i = 0; i < PLANE_COUNT; i++) {
      const material = new MeshBasicMaterial({
        color: this.heatColor.clone(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(this.geo, material);
      const baseX = (i - (PLANE_COUNT - 1) / 2) * 1.1;
      mesh.position.set(baseX, height * 0.5, 0);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.planes.push({
        mesh,
        material,
        phase: (i / PLANE_COUNT) * Math.PI * 2,
        baseX,
      });
    }
  }

  /**
   * Advances the shimmer. `intensity` (0..1) drives visibility, opacity, and
   * the vertical drift speed; `dt` seconds. Below a small threshold the whole
   * group is hidden so it is free when cool.
   */
  update(intensity: number, dt: number): void {
    if (intensity <= 0.02) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.time += dt * (1.5 + intensity * 2.5);

    for (let i = 0; i < this.planes.length; i++) {
      const p = this.planes[i];
      const wobble = Math.sin(this.time + p.phase);
      p.mesh.position.x = p.baseX + wobble * 0.25 * intensity;
      p.mesh.position.y = 1.4 + ((this.time * 0.3 + i) % 1) * 1.6;
      p.mesh.scale.y = 1 + wobble * 0.15;
      p.material.opacity = 0.06 * intensity * (0.6 + 0.4 * (wobble + 1) * 0.5);
    }
  }

  dispose(): void {
    for (const p of this.planes) p.material.dispose();
    this.geo.dispose();
  }
}
