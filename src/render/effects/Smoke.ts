/**
 * Exhaust smoke puffs from the locomotive stack.
 *
 * A small pool of billboarded sprite-like puffs (flat planes always facing the
 * camera would need a camera ref; instead we use cheap upward-drifting quads
 * whose colour darkens with engine load). Puffs are emitted at a rate that
 * scales with throttle/power and rise + fade over a short lifetime. The pool is
 * fixed-size so there are no per-frame allocations.
 *
 * The emitter world-position is set each frame by the caller (the stack top,
 * transformed into world space). Colour goes from pale grey at idle to near
 * black under heavy load, matching a straining diesel.
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

interface Puff {
  mesh: Mesh;
  material: MeshBasicMaterial;
  age: number;
  life: number;
  velocity: Vector3;
  active: boolean;
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
      });
    }
  }

  /** Sets the world-space emission point (stack top). */
  setEmitPosition(x: number, y: number, z: number): void {
    this.emitPos.set(x, y, z);
  }

  private spawn(load: number): void {
    const puff = this.puffs.find((p) => !p.active);
    if (!puff) return;
    puff.active = true;
    puff.age = 0;
    puff.life = 1.4 + Math.random() * 1.2;
    puff.mesh.visible = true;
    puff.mesh.position.copy(this.emitPos);
    // Rise + slight backward drift (train moves +X, smoke trails −X).
    puff.velocity.set(
      -1.5 - Math.random() * 1.5,
      2.2 + Math.random() * 1.4,
      (Math.random() - 0.5) * 0.6,
    );
    const startScale = 0.7 + Math.random() * 0.5;
    puff.mesh.scale.setScalar(startScale);
    // Darker under load.
    this.tmpColor.copy(this.lightColor).lerp(this.darkColor, load);
    puff.material.color.copy(this.tmpColor);
  }

  /**
   * Advances the smoke. `load` (0..1) scales emission rate and darkness; `dt`
   * seconds. `cameraQuat`-free billboarding: puffs simply keep their default
   * orientation (facing +Z, the camera's default side view) which reads fine in
   * the near-side-on camera. Callers may pass a face target via
   * {@link faceCamera} if they want stricter billboarding.
   */
  update(load: number, dt: number): void {
    // Emission: 0 puffs/s at idle up to ~18/s at full load.
    const rate = 2 + load * 16;
    this.emitAccumulator += rate * dt;
    while (this.emitAccumulator >= 1) {
      this.emitAccumulator -= 1;
      this.spawn(load);
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
      const scale = 0.8 + t * 3.2;
      puff.mesh.scale.setScalar(scale);
      // Fade in fast, out slow.
      puff.material.opacity = Math.min(1, t * 4) * (1 - t) * 0.75;
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
