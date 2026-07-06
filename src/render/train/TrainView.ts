/**
 * Composes and drives the full train: locomotive + coupled wagons.
 *
 * Responsibilities:
 *   - Builds the locomotive for the snapshot's `locomotiveId`, swapping the
 *     model when an upgrade changes it.
 *   - Reads the snapshot's cargo list, expands each job into `wagonCount`
 *     wagons (material chosen from the cargo job), and adds/removes wagon models
 *     when the cargo changes.
 *   - Places every vehicle along the route curve: each sits at its own X behind
 *     the loco, lifted to the local rail elevation and pitched to the local
 *     grade so the whole train follows hills.
 *   - Animates wheels from speed/slip, adds subtle idle suspension bounce/sway.
 *   - Positions the exhaust smoke emitter at the stack, sparks at the driving
 *     wheels, and the heat shimmer above the engine, and forwards their drive
 *     parameters from the snapshot.
 *
 * All heavy construction happens on model creation / cargo change; the per
 * frame {@link update} avoids allocations beyond a couple of reused vectors.
 */

import { Group, Vector3 } from "three";
import type { GameSnapshot } from "../../game/simulation/types";
import { getCargoJobById } from "../../game/data";
import { trackPitchAt, trackPointAt } from "../routeGeometry";
import { Locomotive } from "./Locomotive";
import { Wagon } from "./Wagon";
import { Coupler } from "./Coupler";
import { Smoke } from "../effects/Smoke";
import { Sparks } from "../effects/Sparks";
import { HeatShimmer } from "../effects/HeatShimmer";
import {
  TEMP_CRITICAL_C,
  TEMP_WARNING_C,
} from "../../game/simulation/constants";

/** Gap between vehicle centres beyond half-lengths, metres. */
const COUPLER_GAP = 1.5;

interface VehicleEntry {
  /** "loco" or a stable per-wagon key derived from job + index. */
  key: string;
  group: Group;
  length: number;
  updateWheels(groundSpeed: number, slipRatio: number, dt: number): void;
  dispose(): void;
  /** Idle-motion phase offset so vehicles don't bounce in lockstep. */
  phase: number;
}

/** The composed, animated train. */
export class TrainView {
  readonly group: Group;
  /** Effects groups the caller adds to the scene (they live in world space). */
  readonly smoke: Smoke;
  readonly sparks: Sparks;
  readonly heat: HeatShimmer;

  private loco: Locomotive;
  private locomotiveId: string;
  private readonly vehicles: VehicleEntry[] = [];
  /** Signature of the current cargo layout, to detect changes. */
  private cargoSignature = "";

  // Reused temporaries (no per-frame allocation).
  private readonly tmpVec = new Vector3();
  private idleTime = 0;

  constructor(snapshot: GameSnapshot) {
    this.group = new Group();
    this.group.name = "train";

    this.locomotiveId = snapshot.locomotiveId;
    this.loco = new Locomotive(this.locomotiveId);
    this.group.add(this.loco.group);
    this.vehicles.push({
      key: "loco",
      group: this.loco.group,
      length: this.loco.length,
      updateWheels: (s, slip, dt) => this.loco.updateWheels(s, slip, dt),
      dispose: () => this.loco.dispose(),
      phase: 0,
    });

    this.smoke = new Smoke();
    this.sparks = new Sparks();
    this.heat = new HeatShimmer();
    // Heat shimmer rides with the loco; smoke/sparks live in world space.
    this.loco.group.add(this.heat.group);

    this.syncCargo(snapshot);
  }

  /** Builds a stable signature string of the cargo layout. */
  private buildCargoSignature(snapshot: GameSnapshot): string {
    return snapshot.cargo.map((c) => `${c.jobId}x${c.wagonCount}`).join("|");
  }

  /** Rebuilds wagons to match the snapshot cargo if it changed. */
  private syncCargo(snapshot: GameSnapshot): void {
    const signature = this.buildCargoSignature(snapshot);
    if (signature === this.cargoSignature && this.vehicles.length > 0) return;
    this.cargoSignature = signature;

    // Remove all existing wagon + coupler entries (keep the loco at index 0).
    for (let i = this.vehicles.length - 1; i >= 1; i--) {
      const v = this.vehicles[i];
      this.group.remove(v.group);
      v.dispose();
      this.vehicles.splice(i, 1);
    }

    // Expand each cargo job into wagons using its material.
    for (const cargo of snapshot.cargo) {
      const job = getCargoJobById(cargo.jobId);
      const material = job?.material ?? "crate";
      for (let w = 0; w < cargo.wagonCount; w++) {
        const wagon = new Wagon(material);
        const key = `${cargo.jobId}#${w}`;
        this.group.add(wagon.group);
        this.vehicles.push({
          key,
          group: wagon.group,
          length: wagon.length,
          updateWheels: (s, _slip, dt) => wagon.updateWheels(s, dt),
          dispose: () => wagon.dispose(),
          phase: (this.vehicles.length % 5) * 1.3,
        });
      }
    }

    // Rebuild couplers between consecutive vehicles.
    this.rebuildCouplers();
  }

  private couplers: Coupler[] = [];

  private rebuildCouplers(): void {
    for (const c of this.couplers) {
      this.group.remove(c.group);
      c.dispose();
    }
    this.couplers = [];
    for (let i = 0; i < this.vehicles.length - 1; i++) {
      const coupler = new Coupler(0.85, COUPLER_GAP);
      this.group.add(coupler.group);
      this.couplers.push(coupler);
    }
  }

  /** Swaps the locomotive model when the snapshot's loco id changes. */
  private syncLocomotive(snapshot: GameSnapshot): void {
    if (snapshot.locomotiveId === this.locomotiveId) return;
    this.locomotiveId = snapshot.locomotiveId;

    // Dispose the old loco + move the heat shimmer to the new one.
    this.loco.group.remove(this.heat.group);
    this.group.remove(this.loco.group);
    this.loco.dispose();

    this.loco = new Locomotive(this.locomotiveId);
    this.loco.group.add(this.heat.group);
    this.group.add(this.loco.group);

    this.vehicles[0] = {
      key: "loco",
      group: this.loco.group,
      length: this.loco.length,
      updateWheels: (s, slip, dt) => this.loco.updateWheels(s, slip, dt),
      dispose: () => this.loco.dispose(),
      phase: 0,
    };
  }

  /**
   * Positions a vehicle group at route position `x`: sets world position at the
   * local rail elevation, and pitches it to the local grade so it noses up on
   * climbs. Adds a small idle bounce/sway keyed off `idleTime` + phase.
   */
  private placeVehicle(
    group: Group,
    x: number,
    phase: number,
    speedMag: number,
  ): void {
    const p = trackPointAt(x);
    const pitch = trackPitchAt(x);
    // Idle bounce fades in as the train slows (heavy idle rock at a stop) and a
    // gentle sway; both are tiny so they don't distract from driving.
    const bounce = Math.sin(this.idleTime * 2.1 + phase) * 0.012;
    const sway = Math.sin(this.idleTime * 1.3 + phase * 0.7) * 0.01;
    // A hair more motion at speed from rail joints.
    const jitter =
      Math.sin(this.idleTime * 9 + phase) * 0.004 * (speedMag > 1 ? 1 : 0);
    group.position.set(x, p.y + bounce + jitter, 0);
    group.rotation.z = pitch;
    group.rotation.x = sway;
  }

  /**
   * Per-frame update. Reads the snapshot for loco id / cargo / speed / slip /
   * temperature and drives the whole train + effects. `dt` seconds.
   */
  update(snapshot: GameSnapshot, dt: number): void {
    this.idleTime += dt;
    this.syncLocomotive(snapshot);
    this.syncCargo(snapshot);

    const speed = snapshot.speed;
    const speedMag = Math.abs(speed);
    const slip = snapshot.slipRatio;

    // Lay vehicles out behind the loco head. The loco head sits at the train's
    // reported position; each following vehicle is offset by cumulative spacing.
    let cursorX = snapshot.positionX;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (i === 0) {
        // Loco: its head is at positionX; centre it half a length back.
        cursorX = snapshot.positionX - v.length / 2;
        this.placeVehicle(v.group, cursorX, v.phase, speedMag);
        v.updateWheels(speed, slip, dt);
        cursorX -= v.length / 2;
      } else {
        // Coupler sits in the gap between the previous vehicle's rear and this
        // vehicle's front.
        const couplerX = cursorX - COUPLER_GAP / 2;
        const coupler = this.couplers[i - 1];
        if (coupler) {
          const cp = trackPointAt(couplerX);
          coupler.group.position.set(couplerX, cp.y, 0);
          coupler.group.rotation.z = trackPitchAt(couplerX);
        }
        const centerX = cursorX - COUPLER_GAP - v.length / 2;
        this.placeVehicle(v.group, centerX, v.phase, speedMag);
        v.updateWheels(speed, slip, dt);
        cursorX = centerX - v.length / 2;
      }
    }

    // --- Effects ---
    // Smoke load from throttle proxy: use speed + slip + temperature as a stand
    // in for engine load (the snapshot doesn't expose throttle directly, but a
    // hot, slipping, or accelerating engine is working hard). Clamp to 0..1.
    const tempLoad = clamp01(
      (snapshot.temperatureC - 40) / (TEMP_CRITICAL_C - 40),
    );
    const smokeLoad = clamp01(0.25 + tempLoad * 0.75);
    // Emit smoke from the stack, transformed to world space.
    this.tmpVec.set(this.loco.stackLocalX, this.loco.stackLocalY, 0);
    this.loco.group.localToWorld(this.tmpVec);
    this.smoke.setEmitPosition(this.tmpVec.x, this.tmpVec.y, this.tmpVec.z);
    this.smoke.update(smokeLoad, dt);

    // Sparks: only while slipping or braking hard at speed.
    const slipping = snapshot.tractionState === "slipping";
    const sparkIntensity = slipping ? clamp01((slip - 1) * 1.5 + 0.4) : 0;
    if (sparkIntensity > 0) {
      // Emit near the front driving wheel's rail contact.
      this.tmpVec.set(-this.loco.length * 0.15, 0.05, 0);
      this.loco.group.localToWorld(this.tmpVec);
      this.sparks.setEmitPosition(this.tmpVec.x, this.tmpVec.y, this.tmpVec.z);
    }
    this.sparks.update(sparkIntensity, dt);

    // Heat shimmer above the engine, intensity from temperature.
    const heatIntensity =
      snapshot.temperatureC <= TEMP_WARNING_C
        ? 0
        : clamp01(
            (snapshot.temperatureC - TEMP_WARNING_C) /
              (TEMP_CRITICAL_C - TEMP_WARNING_C),
          );
    // The heat group rides in loco-local space; lift it above the hood.
    this.heat.group.position.set(this.loco.length * 0.1, 3.6, 0);
    this.heat.update(heatIntensity, dt);
  }

  /** Orients camera-facing effects (call after camera update). */
  faceCamera(camPos: Vector3): void {
    this.smoke.faceCamera(camPos);
  }

  /** The current locomotive world position (for camera follow). */
  getFollowTarget(out: Vector3): Vector3 {
    return out.copy(this.loco.group.position);
  }

  dispose(): void {
    for (const v of this.vehicles) v.dispose();
    for (const c of this.couplers) c.dispose();
    this.smoke.dispose();
    this.sparks.dispose();
    this.heat.dispose();
  }
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
