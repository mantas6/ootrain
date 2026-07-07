/**
 * Advancing fire-front visual at the snapshot's `fireFrontX`.
 *
 * Renders the wall of fire chasing the train so it engulfs the *whole* terrain
 * tile footprint, not just a narrow strip by the rails: a grid of emissive
 * flame cones that spans the full tile depth (across Z) and a band behind the
 * front (along X), a warm ground glow covering the tile footprint, a rising
 * ember particle field, and a pulsing point light. The whole group is moved to
 * the fire X each frame; regions *behind* the front are switched to burned
 * variants by {@link WorldView} (this view only draws the front + its glow).
 *
 * Flame layout is deterministic (seeded per slot via {@link planFlameSlots}) so
 * the wall looks stable; only the flicker/ember animation is time-driven.
 * Particle pools are fixed-size (no per-frame allocation) and counts are scaled
 * to the covered area, not silly-large.
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
import { hashSeed, seededRandom } from "../routeGeometry";

/**
 * Depth across Z the fire covers, metres. Matches the terrain tile ground
 * depth (`depth` in {@link TerrainTile}'s `buildGround`) so the wall of fire
 * reaches both tile edges instead of hugging the track corridor.
 */
const TILE_DEPTH = 90;
/**
 * Width along X the fire footprint covers, metres. Matches the world chunk /
 * tile width (`CHUNK_SIZE` in {@link WorldView}) so the ground glow blankets a
 * whole tile behind the advancing front.
 */
const TILE_WIDTH = 200;
/** Depth along X of the active flame band trailing behind the front, metres. */
const FRONT_DEPTH = 60;
/** Flame grid: columns across Z (tile depth) × rows along X (front band). */
const FLAME_COLS = 13;
const FLAME_ROWS = 6;
const EMBER_COUNT = 220;

/** A deterministic flame placement within the fire footprint. */
export interface FlameSlot {
  /** X offset from the front (<= 0: trailing behind into the burned region). */
  x: number;
  /** Z offset across the tile depth (edge to edge). */
  z: number;
  /** Untouched base scale of the cone. */
  baseScale: number;
  /** Flicker phase offset, radians. */
  phase: number;
  /** 0 at the leading edge, 1 at the back of the band (height falloff). */
  depthT: number;
}

/**
 * Lays out a grid of flame slots that spans the full tile depth across Z and a
 * band of `frontDepth` behind the front along X. Pure and deterministic (seeded
 * hash PRNG) so the wall of fire is stable frame to frame. The outermost
 * columns sit exactly on the tile edges (±`tileDepth`/2) so coverage always
 * reaches edge to edge; interior columns get bounded jitter for a natural look.
 */
export function planFlameSlots(
  cols: number,
  rows: number,
  tileDepth: number,
  frontDepth: number,
  seed = 0xf12e,
): FlameSlot[] {
  const rand = seededRandom(hashSeed(cols * 131 + rows, seed));
  const halfDepth = tileDepth / 2;
  const slots: FlameSlot[] = [];
  for (let r = 0; r < rows; r++) {
    const depthT = rows > 1 ? r / (rows - 1) : 0;
    const x = -depthT * frontDepth;
    for (let c = 0; c < cols; c++) {
      const base = cols > 1 ? (c / (cols - 1) - 0.5) * tileDepth : 0;
      // Edge columns stay pinned to the tile edge; interior columns jitter.
      const edge = c === 0 || c === cols - 1;
      const jitter = edge ? 0 : (rand() - 0.5) * (tileDepth / cols);
      const z = Math.max(-halfDepth, Math.min(halfDepth, base + jitter));
      slots.push({
        x,
        z,
        baseScale: (0.75 + rand() * 0.7) * (1 - 0.4 * depthT),
        phase: rand() * Math.PI * 2,
        depthT,
      });
    }
  }
  return slots;
}

interface Flame {
  mesh: Mesh;
  material: MeshBasicMaterial;
  baseScale: number;
  phase: number;
  baseY: number;
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
  private readonly emberRand = seededRandom(hashSeed(EMBER_COUNT, 0xe3be));

  private time = 0;
  private currentX = 0;
  private readonly hot = new Color(PALETTE.ember);
  private readonly cool = new Color(PALETTE.heat);

  constructor() {
    this.group = new Group();
    this.group.name = "fire-front";

    // Flame cones laid out across the full tile depth and a band behind the
    // front, so the fire engulfs the whole tile footprint.
    const coneGeo = new ConeGeometry(1.4, 3.4, 7);
    const slots = planFlameSlots(
      FLAME_COLS,
      FLAME_ROWS,
      TILE_DEPTH,
      FRONT_DEPTH,
    );
    for (const slot of slots) {
      const material = new MeshBasicMaterial({
        color: this.hot.clone(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(coneGeo, material);
      const baseY = 1.8 * (1 - 0.35 * slot.depthT);
      mesh.position.set(slot.x, baseY, slot.z);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.flames.push({
        mesh,
        material,
        baseScale: slot.baseScale,
        phase: slot.phase,
        baseY,
      });
    }

    // Ground glow: a flat additive plane covering the tile footprint, biased to
    // trail behind the front into the burned region. Rotated flat about X so the
    // geometry width maps to world X and its height to world Z.
    this.glowMat = new MeshBasicMaterial({
      color: PALETTE.ember,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.glow = new Mesh(
      new PlaneGeometry(TILE_WIDTH, TILE_DEPTH + 10),
      this.glowMat,
    );
    this.glow.rotation.x = -Math.PI / 2;
    // Extend ~30 m ahead of the front and the rest behind it.
    this.glow.position.set(-TILE_WIDTH / 2 + 30, 0.2, 0);
    this.glow.frustumCulled = false;
    this.group.add(this.glow);

    // Pulsing fire light, ranged to reach across the whole tile.
    this.light = new PointLight(PALETTE.ember, 40, 180, 2);
    this.light.position.set(-6, 8, 0);
    this.group.add(this.light);

    // Ember particles rising off the front across its full width.
    this.emberPos = new Float32Array(EMBER_COUNT * 3);
    this.emberVel = new Float32Array(EMBER_COUNT * 3);
    this.emberAge = new Float32Array(EMBER_COUNT);
    this.emberLife = new Float32Array(EMBER_COUNT);
    for (let i = 0; i < EMBER_COUNT; i++) {
      this.resetEmber(i);
      // Stagger initial ages so the field is populated on the first frame.
      this.emberAge[i] = this.emberRand() * this.emberLife[i];
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
    const rand = this.emberRand;
    // Spawn anywhere in the flame band (X) and across the full tile depth (Z).
    this.emberPos[i3] = 5 - rand() * (FRONT_DEPTH + 5);
    this.emberPos[i3 + 1] = rand() * 2;
    this.emberPos[i3 + 2] = (rand() - 0.5) * TILE_DEPTH;
    this.emberVel[i3] = -0.5 - rand();
    this.emberVel[i3 + 1] = 2 + rand() * 3;
    this.emberVel[i3 + 2] = (rand() - 0.5) * 1.5;
    this.emberAge[i] = 0;
    this.emberLife[i] = 1.5 + rand() * 2;
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
      f.mesh.position.y = f.baseY * f.baseScale * (0.8 + flick * 0.3);
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
