/**
 * Procedural diesel locomotive factory.
 *
 * Builds a detailed side-readable loco from primitives: chassis/underframe,
 * a long hood, a cab with inset windows, buffers, an exhaust stack, fuel tanks,
 * roof vents, side ladders, handrails, and a headlight. Two visual variants are
 * supported and selected by locomotive id:
 *
 *   - `loco-1` (diesel-electric starter): shorter, cool blue-green, single
 *     hood, one radiator vent bank.
 *   - `loco-2` (diesel-hydraulic upgrade): longer, heavier maroon, twin vent
 *     banks and a bigger stack — visibly the "stronger" machine.
 *
 * The loco body sits centred at the group origin with its length along +X and
 * the cab toward −X (rear); the nose points forward (+X, travel direction).
 * Wheelsets are exposed so {@link TrainView} can animate them. All geometry is
 * built at construction; nothing here needs a GL context.
 */

import { BoxGeometry, CylinderGeometry, Group, Mesh, PointLight } from "three";
import { PALETTE, paletteMaterial, stdMaterial } from "../palette";
import { WheelSet } from "./WheelSet";
import { addBuffers, addHandrail, addLadder } from "./detailParts";

/** A locomotive visual variant resolved from its id. */
interface LocoVariant {
  bodyColor: number;
  roofColor: number;
  trimColor: number;
  /** Overall body length, metres. */
  length: number;
  /** Number of radiator vent banks along the hood. */
  ventBanks: number;
  /** Exhaust-stack radius, metres. */
  stackRadius: number;
}

const VARIANTS: Record<string, LocoVariant> = {
  "loco-1": {
    bodyColor: PALETTE.loco1Body,
    roofColor: PALETTE.loco1Roof,
    trimColor: PALETTE.loco1Trim,
    length: 12,
    ventBanks: 1,
    stackRadius: 0.28,
  },
  "loco-2": {
    bodyColor: PALETTE.loco2Body,
    roofColor: PALETTE.loco2Roof,
    trimColor: PALETTE.loco2Trim,
    length: 14.5,
    ventBanks: 2,
    stackRadius: 0.36,
  },
};

function variantFor(id: string): LocoVariant {
  return VARIANTS[id] ?? VARIANTS["loco-1"];
}

/** A constructed locomotive model. */
export class Locomotive {
  readonly group: Group;
  readonly wheelSets: WheelSet[] = [];
  /** Total body length, metres (used for coupler / spacing math). */
  readonly length: number;
  /** World-local X of the exhaust stack top (for smoke emitter placement). */
  readonly stackLocalX: number;
  readonly stackLocalY: number;
  /** The locomotive id this model represents. */
  readonly locomotiveId: string;

  private readonly headlight: PointLight;

  constructor(locomotiveId: string) {
    this.locomotiveId = locomotiveId;
    const v = variantFor(locomotiveId);
    this.length = v.length;
    this.group = new Group();
    this.group.name = `locomotive:${locomotiveId}`;

    const bodyMat = stdMaterial({
      color: v.bodyColor,
      roughness: 0.72,
      metalness: 0.28,
    });
    const roofMat = stdMaterial({
      color: v.roofColor,
      roughness: 0.75,
      metalness: 0.25,
    });
    const trimMat = stdMaterial({
      color: v.trimColor,
      roughness: 0.6,
      metalness: 0.2,
    });
    const chassisMat = paletteMaterial("chassis", {
      roughness: 0.8,
      metalness: 0.3,
    });
    const metalMat = paletteMaterial("metalDark", {
      roughness: 0.55,
      metalness: 0.55,
    });

    const halfLen = v.length / 2;
    const bodyWidth = 2.6;
    const railTopY = 0.55; // wheel radius ≈ rail contact height
    const frameY = railTopY + 0.35;

    // --- Underframe / chassis ---
    const frame = new Mesh(
      new BoxGeometry(v.length, 0.5, bodyWidth + 0.2),
      chassisMat,
    );
    frame.position.y = frameY;
    frame.castShadow = true;
    frame.receiveShadow = true;
    this.group.add(frame);

    // --- Long hood (engine compartment), toward the front (+X) ---
    const hoodLen = v.length * 0.62;
    const hoodHeight = 2.2;
    const hoodY = frameY + 0.25 + hoodHeight / 2;
    const hoodX = halfLen - hoodLen / 2 - 0.4; // biased forward
    const hood = new Mesh(
      new BoxGeometry(hoodLen, hoodHeight, bodyWidth),
      bodyMat,
    );
    hood.position.set(hoodX, hoodY, 0);
    hood.castShadow = true;
    hood.receiveShadow = true;
    this.group.add(hood);

    // Sloped nose cap at the very front for a stronger silhouette.
    const nose = new Mesh(
      new BoxGeometry(1.1, hoodHeight * 0.7, bodyWidth * 0.96),
      bodyMat,
    );
    nose.position.set(halfLen - 0.55, hoodY - hoodHeight * 0.12, 0);
    nose.castShadow = true;
    this.group.add(nose);

    // Trim stripe along the hood sides.
    for (const z of [-1, 1]) {
      const stripe = new Mesh(
        new BoxGeometry(hoodLen * 0.98, 0.28, 0.04),
        trimMat,
      );
      stripe.position.set(hoodX, hoodY + 0.1, z * (bodyWidth / 2 + 0.01));
      this.group.add(stripe);
    }

    // --- Cab, toward the rear (−X) ---
    const cabLen = v.length * 0.26;
    const cabHeight = 2.7;
    const cabY = frameY + 0.25 + cabHeight / 2;
    const cabX = -halfLen + cabLen / 2 + 0.3;
    const cab = new Mesh(
      new BoxGeometry(cabLen, cabHeight, bodyWidth + 0.05),
      bodyMat,
    );
    cab.position.set(cabX, cabY, 0);
    cab.castShadow = true;
    cab.receiveShadow = true;
    this.group.add(cab);

    // Cab roof (slightly overhanging, darker).
    const cabRoof = new Mesh(
      new BoxGeometry(cabLen + 0.4, 0.28, bodyWidth + 0.4),
      roofMat,
    );
    cabRoof.position.set(cabX, cabY + cabHeight / 2 + 0.1, 0);
    cabRoof.castShadow = true;
    this.group.add(cabRoof);

    // Inset windows on both sides + front of the cab (dark glazing).
    const windowMat = paletteMaterial("window", {
      roughness: 0.25,
      metalness: 0.1,
    });
    for (const z of [-1, 1]) {
      const win = new Mesh(
        new BoxGeometry(cabLen * 0.6, cabHeight * 0.32, 0.06),
        windowMat,
      );
      win.position.set(
        cabX,
        cabY + cabHeight * 0.14,
        z * (bodyWidth / 2 + 0.04),
      );
      this.group.add(win);
    }
    const frontWin = new Mesh(
      new BoxGeometry(0.06, cabHeight * 0.3, bodyWidth * 0.6),
      windowMat,
    );
    frontWin.position.set(cabX + cabLen / 2 + 0.02, cabY + cabHeight * 0.16, 0);
    this.group.add(frontWin);

    // --- Radiator vent banks along the hood sides ---
    const ventMat = paletteMaterial("metalMid", {
      roughness: 0.5,
      metalness: 0.6,
    });
    const bankSpacing = hoodLen / (v.ventBanks + 1);
    for (let b = 0; b < v.ventBanks; b++) {
      const bx = hoodX - hoodLen / 2 + bankSpacing * (b + 1);
      for (const z of [-1, 1]) {
        const vent = new Mesh(
          new BoxGeometry(0.7, hoodHeight * 0.6, 0.08),
          ventMat,
        );
        vent.position.set(bx, hoodY, z * (bodyWidth / 2 + 0.02));
        this.group.add(vent);
      }
    }

    // --- Exhaust stack on the hood roof (front third) ---
    const stack = new Mesh(
      new CylinderGeometry(v.stackRadius, v.stackRadius * 1.15, 0.8, 12),
      metalMat,
    );
    this.stackLocalX = hoodX + hoodLen * 0.25;
    this.stackLocalY = hoodY + hoodHeight / 2 + 0.4;
    stack.position.set(this.stackLocalX, this.stackLocalY, 0);
    stack.castShadow = true;
    this.group.add(stack);

    // Roof fan grille near the stack.
    const fan = new Mesh(new CylinderGeometry(0.5, 0.5, 0.14, 16), ventMat);
    fan.position.set(hoodX - hoodLen * 0.1, hoodY + hoodHeight / 2 + 0.08, 0);
    this.group.add(fan);

    // --- Fuel / air tanks slung under the frame ---
    const tankMat = paletteMaterial("tank", {
      roughness: 0.5,
      metalness: 0.6,
    });
    for (const tx of [-v.length * 0.12, v.length * 0.12]) {
      const tank = new Mesh(
        new CylinderGeometry(0.42, 0.42, v.length * 0.28, 14),
        tankMat,
      );
      tank.rotation.z = Math.PI / 2;
      tank.position.set(tx, frameY - 0.35, 0);
      tank.castShadow = true;
      this.group.add(tank);
    }

    // --- Buffers front & rear ---
    addBuffers(this.group, halfLen, frameY, bodyWidth);
    addBuffers(this.group, -halfLen, frameY, bodyWidth);

    // --- Side ladders (rear corners) + handrails ---
    for (const z of [-1, 1]) {
      addLadder(
        this.group,
        cabX - cabLen / 2 - 0.1,
        railTopY,
        z * (bodyWidth / 2 + 0.05),
        cabHeight * 0.7,
      );
    }
    // Long handrail down each hood side.
    for (const z of [-1, 1]) {
      addHandrail(
        this.group,
        hoodX,
        hoodY - hoodHeight / 2 + 0.15,
        z * (bodyWidth / 2 + 0.12),
        hoodLen * 0.9,
      );
    }

    // --- Headlight on the nose (emissive + a soft point light) ---
    const lampMat = paletteMaterial("headlight", {
      emissive: PALETTE.headlight,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });
    const lamp = new Mesh(new CylinderGeometry(0.2, 0.2, 0.12, 12), lampMat);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(halfLen - 0.02, hoodY + 0.2, 0);
    this.group.add(lamp);

    this.headlight = new PointLight(PALETTE.headlight, 6, 40, 2);
    this.headlight.position.set(halfLen + 1.5, hoodY + 0.2, 0);
    this.group.add(this.headlight);

    // --- Wheelsets (three axles; extra for the longer loco-2) ---
    const axleCount = v.length > 13 ? 4 : 3;
    const axleSpan = v.length * 0.62;
    for (let i = 0; i < axleCount; i++) {
      const ws = new WheelSet({ radius: railTopY, driven: true });
      const t = i / (axleCount - 1);
      ws.group.position.set(-axleSpan / 2 + t * axleSpan, railTopY, 0);
      this.wheelSets.push(ws);
      this.group.add(ws.group);
    }
  }

  /** Advances wheel rotation for the whole loco. */
  updateWheels(groundSpeed: number, slipRatio: number, dt: number): void {
    for (const ws of this.wheelSets) ws.update(groundSpeed, slipRatio, dt);
  }

  /** Frees geometries owned by this loco (materials are shared/cached). */
  dispose(): void {
    this.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
}
