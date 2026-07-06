/**
 * Advancing fire-front visual at the snapshot's `fireFrontX`.
 *
 * Renders the wall of fire chasing the train: a row of emissive flame cones
 * that flicker, a warm ground glow, a rising ember particle field, and a dark
 * smoke column behind the front. The whole group is moved to the fire X each
 * frame; regions *behind* the front are switched to burned variants by
 * {@link WorldView} (this view only draws the front itself and its glow).
 *
 * Particle pools are fixed-size (no per-frame allocation). A soft point light
 * pulses at the front so nearby terrain catches the orange glow.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
} from "three";
import { PALETTE } from "../palette";
import { getElevationAt } from "../../game/data";

const FLAME_COUNT = 9;
const EMBER_COUNT = 80;
/** Width across Z the fire wall spans, metres. */
const WALL_WIDTH = 40;

interface Flame {
  mesh: Mesh;
  material: MeshBasicMaterial;
  baseScale: number;
  phase: number;
  z: number;
}

/** The advancing fire-front effect. */
export class FireFrontView {
  readonly group: Group;
  private readonly flames: Flame[] = [];
  private readonly light: PointLight;
  private readonly glow: Mesh;
  private readonly glowMat: MeshBasicMaterial;

  private readonly embers: Points;
  private readonly emberGeo: BufferGeometry;
  private readonly emberMat: PointsMaterial;
  private readonly emberPos: Float32Array;
  private readonly emberVel: Float32Array;
  private readonly emberAge: Float32Array;
  private readonly emberLife: Float32Array;

  private time = 0;
  private currentX = 0;
  private readonly hot = new Color(PALETTE.ember);
  private readonly cool = new Color(PALETTE.heat);

  constructor() {
    this.group = new Group();
    this.group.name = "fire-front";

    // Flame cones across the wall width.
    const coneGeo = new ConeGeometry(1.1, 3.2, 7);
    for (let i = 0; i < FLAME_COUNT; i++) {
      const z = (i / (FLAME_COUNT - 1) - 0.5) * WALL_WIDTH;
      const material = new MeshBasicMaterial({
        color: this.hot.clone(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(coneGeo, material);
      mesh.position.set(0, 1.8, z);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.flames.push({
        mesh,
        material,
        baseScale: 0.8 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        z,
      });
    }

    // Ground glow: a flat additive plane lying on the ground at the front.
    this.glowMat = new MeshBasicMaterial({
      color: PALETTE.ember,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.glow = new Mesh(new PlaneGeometry(14, WALL_WIDTH + 10), this.glowMat);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.2;
    this.glow.frustumCulled = false;
    this.group.add(this.glow);

    // Pulsing fire light.
    this.light = new PointLight(PALETTE.ember, 40, 120, 2);
    this.light.position.set(-4, 6, 0);
    this.group.add(this.light);

    // Ember particles rising off the front.
    this.emberPos = new Float32Array(EMBER_COUNT * 3);
    this.emberVel = new Float32Array(EMBER_COUNT * 3);
    this.emberAge = new Float32Array(EMBER_COUNT);
    this.emberLife = new Float32Array(EMBER_COUNT);
    for (let i = 0; i < EMBER_COUNT; i++) {
      this.emberAge[i] = Math.random() * 2;
      this.emberLife[i] = 1.5 + Math.random() * 2;
      this.resetEmber(i);
    }
    this.emberGeo = new BufferGeometry();
    this.emberGeo.setAttribute(
      "position",
      new Float32BufferAttribute(this.emberPos, 3),
    );
    this.emberMat = new PointsMaterial({
      color: PALETTE.spark,
      size: 0.35,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.embers = new Points(this.emberGeo, this.emberMat);
    this.embers.frustumCulled = false;
    this.group.add(this.embers);
  }

  private resetEmber(i: number): void {
    const i3 = i * 3;
    this.emberPos[i3] = (Math.random() - 0.5) * 6;
    this.emberPos[i3 + 1] = Math.random() * 2;
    this.emberPos[i3 + 2] = (Math.random() - 0.5) * WALL_WIDTH;
    this.emberVel[i3] = -0.5 - Math.random();
    this.emberVel[i3 + 1] = 2 + Math.random() * 3;
    this.emberVel[i3 + 2] = (Math.random() - 0.5) * 1.5;
    this.emberAge[i] = 0;
    this.emberLife[i] = 1.5 + Math.random() * 2;
  }

  /**
   * Moves the front to `fireFrontX` (world X from the snapshot) and animates the
   * flames, glow pulse, and embers. `dt` seconds.
   */
  update(fireFrontX: number, dt: number): void {
    this.time += dt;
    this.currentX = fireFrontX;
    this.group.position.set(fireFrontX, getElevationAt(fireFrontX), 0);

    // Flicker flames: vertical scale + colour lerp + opacity wobble.
    for (const f of this.flames) {
      const flick = 0.7 + 0.5 * Math.sin(this.time * 9 + f.phase);
      const flick2 = 0.85 + 0.3 * Math.sin(this.time * 5.3 + f.phase * 1.7);
      f.mesh.scale.set(
        f.baseScale * flick2,
        f.baseScale * (0.8 + flick * 0.6),
        f.baseScale * flick2,
      );
      f.mesh.position.y = 1.8 * f.baseScale * (0.8 + flick * 0.3);
      f.material.color.copy(this.cool).lerp(this.hot, 0.4 + 0.4 * flick);
      f.material.opacity = 0.65 + 0.3 * flick2;
    }

    // Glow + light pulse.
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 6);
    this.glowMat.opacity = 0.35 + 0.25 * pulse;
    this.light.intensity = 30 + 25 * pulse;

    // Embers rise and recycle.
    const pos = this.emberPos;
    const vel = this.emberVel;
    for (let i = 0; i < EMBER_COUNT; i++) {
      this.emberAge[i] += dt;
      const i3 = i * 3;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      vel[i3 + 1] -= 1.2 * dt; // slight cooling / fall-off
      if (this.emberAge[i] >= this.emberLife[i]) this.resetEmber(i);
    }
    this.emberGeo.attributes.position.needsUpdate = true;
  }

  /** The current world X of the fire front. */
  get frontX(): number {
    return this.currentX;
  }

  dispose(): void {
    for (const f of this.flames) f.material.dispose();
    this.flames[0]?.mesh.geometry.dispose();
    this.glow.geometry.dispose();
    this.glowMat.dispose();
    this.emberGeo.dispose();
    this.emberMat.dispose();
  }
}
