/**
 * Exhaust smoke puffs from the locomotive stack.
 *
 * A small pool of billboarded sprite-like puffs (flat planes always facing the
 * camera would need a camera ref; instead we use cheap upward-drifting quads
 * whose colour darkens with engine load). Puffs are emitted at a rate, size,
 * rise speed, opacity, and darkness that all scale with the engine's RPM (see
 * {@link smokeEmissionParams}), so the plume visibly answers the throttle:
 * sparse/faint/pale at idle, dense/dark/fast under full power. The pool is
 * fixed-size so there are no per-frame allocations.
 *
 * The emitter world-position is set each frame by the caller (the stack top,
 * transformed into world space). Scatter uses `Math.random()` like the other
 * one-shot particle effects (Sparks); it is a purely cosmetic layer with no
 * bearing on sim determinism.
 */

import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Vector3,
} from "three";
import { PALETTE } from "../palette";
import { smokeEmissionParams, type SmokeEmissionParams } from "./smokeParams";

interface Puff {
  mesh: Mesh;
  material: MeshBasicMaterial;
  age: number;
  life: number;
  velocity: Vector3;
  active: boolean;
  /** Puff scale at spawn; growth is applied relative to this. */
  baseScale: number;
  /** Peak opacity this puff fades toward, from the emission params. */
  peakOpacity: number;
}

const MAX_PUFFS = 40;

/** Exhaust smoke particle system. */
export class Smoke {
  readonly group: Group;
  private readonly puffs: Puff[] = [];
  private readonly emitPos = new Vector3();
  private emitAccumulator = 0;
  private readonly geo: PlaneGeometry;
  private readonly darkColor = new Color(PALETTE.smokeDark);
  private readonly lightColor = new Color(PALETTE.smokeLight);
  private readonly tmpColor = new Color();

  constructor() {
    this.group = new Group();
    this.group.name = "smoke";
    // A shared unit quad; each puff scales it. Smoke sits in world space, so we
    // add puffs directly to this group (which the caller adds to the scene).
    this.geo = new PlaneGeometry(1, 1);
    for (let i = 0; i < MAX_PUFFS; i++) {
      const material = new MeshBasicMaterial({
        color: this.lightColor.clone(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: NormalBlending,
      });
      const mesh = new Mesh(this.geo, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.puffs.push({
        mesh,
        material,
        age: 0,
        life: 1,
        velocity: new Vector3(),
        active: false,
        baseScale: 1,
        peakOpacity: 0.75,
      });
    }
  }

  /** Sets the world-space emission point (stack top). */
  setEmitPosition(x: number, y: number, z: number): void {
    this.emitPos.set(x, y, z);
  }

  private spawn(params: SmokeEmissionParams): void {
    const puff = this.puffs.find((p) => !p.active);
    if (!puff) return;
    puff.active = true;
    puff.age = 0;
    puff.life = 1.4 + Math.random() * 1.2;
    puff.mesh.visible = true;
    puff.mesh.position.copy(this.emitPos);
    // Rise + slight backward drift (train moves +X, smoke trails −X). Rise
    // speed scales with engine load so hard-working smoke shoots up faster.
    puff.velocity.set(
      -1.5 - Math.random() * 1.5,
      params.riseSpeed + Math.random() * 1.2,
      (Math.random() - 0.5) * 0.6,
    );
    puff.baseScale = params.spawnScale * (0.85 + Math.random() * 0.4);
    puff.peakOpacity = params.opacity;
    puff.mesh.scale.setScalar(puff.baseScale);
    // Darker under load.
    this.tmpColor.copy(this.lightColor).lerp(this.darkColor, params.darkness);
    puff.material.color.copy(this.tmpColor);
  }

  /**
   * Advances the smoke, driven by the engine's RPM. Emission rate, puff size,
   * rise speed, colour darkness, and opacity all follow
   * {@link smokeEmissionParams}, so low RPM reads as sparse/faint smoke and
   * high RPM as a dense/dark plume. `dt` seconds. `cameraQuat`-free
   * billboarding: puffs keep their default orientation (facing +Z, the
   * camera's default side view) which reads fine in the near-side-on camera.
   * Callers may pass a face target via {@link faceCamera} for stricter
   * billboarding.
   */
  update(engineRpm: number, dt: number): void {
    const params = smokeEmissionParams(engineRpm);
    this.emitAccumulator += params.rate * dt;
    while (this.emitAccumulator >= 1) {
      this.emitAccumulator -= 1;
      this.spawn(params);
    }

    for (const puff of this.puffs) {
      if (!puff.active) continue;
      puff.age += dt;
      if (puff.age >= puff.life) {
        puff.active = false;
        puff.mesh.visible = false;
        puff.material.opacity = 0;
        continue;
      }
      const t = puff.age / puff.life;
      puff.mesh.position.addScaledVector(puff.velocity, dt);
      // Slow the rise over time (buoyancy fading).
      puff.velocity.multiplyScalar(1 - 0.6 * dt);
      // Grow from the spawn size so denser (bigger) puffs stay proportionally
      // larger through their life.
      puff.mesh.scale.setScalar(puff.baseScale * (1 + t * 3));
      // Fade in fast, out slow, scaled by the puff's load-driven peak opacity.
      puff.material.opacity = Math.min(1, t * 4) * (1 - t) * puff.peakOpacity;
    }
  }

  /**
   * Orients all puffs to face a camera position (optional stricter
   * billboarding). Cheap: only rotates active puffs.
   */
  faceCamera(camPos: Vector3): void {
    for (const puff of this.puffs) {
      if (puff.active) puff.mesh.lookAt(camPos);
    }
  }

  dispose(): void {
    for (const puff of this.puffs) puff.material.dispose();
    this.geo.dispose();
  }
}
