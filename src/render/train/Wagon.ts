/**
 * Cargo wagon factory.
 *
 * A wagon is a flat/gondola underframe on two wheelsets, topped with a cargo
 * shape chosen by the job's material string so different loads read at a glance:
 *
 *   - ore / iron ore     → heaped ore mound in a gondola
 *   - coal               → dark heaped mound in a gondola
 *   - crates / machinery  → stacked crates on a flatbed
 *   - tank / diesel / fuel → horizontal tank
 *   - timber / stone      → banded logs / block on a flatbed
 *   - (fallback)          → a covered box van
 *
 * The body length matches the loco/wagon spacing used by {@link TrainView}.
 * Built entirely from primitives with shared materials; no GL context needed.
 */

import { BoxGeometry, CylinderGeometry, Group, Mesh } from "three";
import { PALETTE, paletteMaterial, stdMaterial } from "../palette";
import { WheelSet } from "./WheelSet";
import { addBuffers } from "./detailParts";

/** Cargo shape categories the material string maps to. */
type CargoKind = "mound" | "crates" | "tank" | "timber" | "van";

/** Maps a cargo material string to a visual cargo kind + colour. */
function classifyMaterial(material: string): {
  kind: CargoKind;
  color: number;
} {
  const m = material.toLowerCase();
  if (m.includes("ore")) return { kind: "mound", color: PALETTE.ore };
  if (m.includes("coal")) return { kind: "mound", color: PALETTE.coal };
  if (m.includes("diesel") || m.includes("fuel") || m.includes("tank")) {
    return { kind: "tank", color: PALETTE.tank };
  }
  if (m.includes("timber") || m.includes("log")) {
    return { kind: "timber", color: PALETTE.timber };
  }
  if (m.includes("stone")) return { kind: "van", color: PALETTE.rock };
  if (
    m.includes("crate") ||
    m.includes("machinery") ||
    m.includes("tool") ||
    m.includes("gear") ||
    m.includes("girder") ||
    m.includes("steel") ||
    m.includes("medical")
  ) {
    return { kind: "crates", color: PALETTE.crate };
  }
  return { kind: "van", color: PALETTE.building };
}

/** A constructed wagon model. */
export class Wagon {
  readonly group: Group;
  readonly wheelSets: WheelSet[] = [];
  readonly length: number;

  constructor(material: string, length = 8) {
    this.length = length;
    this.group = new Group();
    this.group.name = `wagon:${material}`;

    const { kind, color } = classifyMaterial(material);
    const bodyWidth = 2.5;
    const railTopY = 0.5;
    const frameY = railTopY + 0.32;
    const deckY = frameY + 0.35;
    const halfLen = length / 2;

    const frameMat = paletteMaterial("chassis", {
      roughness: 0.8,
      metalness: 0.3,
    });
    const deckMat = paletteMaterial("metalMid", {
      roughness: 0.7,
      metalness: 0.35,
    });

    // Underframe.
    const frame = new Mesh(
      new BoxGeometry(length, 0.45, bodyWidth + 0.1),
      frameMat,
    );
    frame.position.y = frameY;
    frame.castShadow = true;
    frame.receiveShadow = true;
    this.group.add(frame);

    // Deck / floor.
    const deck = new Mesh(
      new BoxGeometry(length * 0.94, 0.18, bodyWidth),
      deckMat,
    );
    deck.position.y = deckY;
    deck.receiveShadow = true;
    this.group.add(deck);

    this.buildCargo(kind, color, length, bodyWidth, deckY);

    // Buffers at both ends.
    addBuffers(this.group, halfLen, frameY, bodyWidth);
    addBuffers(this.group, -halfLen, frameY, bodyWidth);

    // Two wheelsets (unpowered bogies), near each end.
    for (const t of [-0.32, 0.32]) {
      const ws = new WheelSet({ radius: railTopY, driven: false });
      ws.group.position.set(t * length, railTopY, 0);
      this.wheelSets.push(ws);
      this.group.add(ws.group);
    }
  }

  private buildCargo(
    kind: CargoKind,
    color: number,
    length: number,
    bodyWidth: number,
    deckY: number,
  ): void {
    const cargoMat = stdMaterial({ color, roughness: 0.92, metalness: 0.08 });

    switch (kind) {
      case "mound": {
        // Gondola walls + a heaped mound (scaled box + capping wedge).
        const wallMat = paletteMaterial("steel", {
          roughness: 0.7,
          metalness: 0.4,
        });
        const wallH = 1.0;
        for (const z of [-1, 1]) {
          const wall = new Mesh(
            new BoxGeometry(length * 0.9, wallH, 0.12),
            wallMat,
          );
          wall.position.set(0, deckY + wallH / 2, z * (bodyWidth / 2 - 0.06));
          wall.castShadow = true;
          this.group.add(wall);
        }
        for (const x of [-1, 1]) {
          const end = new Mesh(
            new BoxGeometry(0.12, wallH, bodyWidth - 0.1),
            wallMat,
          );
          end.position.set(x * (length * 0.45), deckY + wallH / 2, 0);
          this.group.add(end);
        }
        const mound = new Mesh(
          new BoxGeometry(length * 0.82, 0.8, bodyWidth - 0.3),
          cargoMat,
        );
        mound.position.set(0, deckY + wallH + 0.25, 0);
        mound.scale.set(1, 1, 1);
        mound.castShadow = true;
        this.group.add(mound);
        break;
      }
      case "crates": {
        // A stack of crates of varied size.
        const sizes = [
          { w: 1.3, h: 1.2, d: 1.6, x: -length * 0.28, y: 0.6 },
          { w: 1.5, h: 1.4, d: 1.8, x: 0, y: 0.7 },
          { w: 1.2, h: 1.0, d: 1.4, x: length * 0.28, y: 0.5 },
          { w: 1.0, h: 0.9, d: 1.2, x: -length * 0.05, y: 1.6 },
        ];
        for (const s of sizes) {
          const crate = new Mesh(new BoxGeometry(s.w, s.h, s.d), cargoMat);
          crate.position.set(s.x, deckY + s.y, 0);
          crate.castShadow = true;
          this.group.add(crate);
        }
        break;
      }
      case "tank": {
        const tank = new Mesh(
          new CylinderGeometry(1.05, 1.05, length * 0.82, 18),
          cargoMat,
        );
        tank.rotation.z = Math.PI / 2;
        tank.position.set(0, deckY + 1.1, 0);
        tank.castShadow = true;
        this.group.add(tank);
        // End caps + a top dome hatch.
        const hatch = new Mesh(
          new CylinderGeometry(0.3, 0.3, 0.2, 10),
          paletteMaterial("metalDark", { roughness: 0.5, metalness: 0.6 }),
        );
        hatch.position.set(0, deckY + 2.2, 0);
        this.group.add(hatch);
        break;
      }
      case "timber": {
        // A raft of horizontal logs held by end stanchions.
        const logMat = stdMaterial({
          color,
          roughness: 0.95,
          metalness: 0.05,
        });
        const rows = 2;
        const perRow = 4;
        const logR = 0.28;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < perRow; c++) {
            const log = new Mesh(
              new CylinderGeometry(logR, logR, length * 0.85, 8),
              logMat,
            );
            log.rotation.z = Math.PI / 2;
            log.position.set(
              0,
              deckY + logR + r * (logR * 1.9) + 0.15,
              (c - (perRow - 1) / 2) * (logR * 2.05),
            );
            log.castShadow = true;
            this.group.add(log);
          }
        }
        // End stanchions.
        const stMat = paletteMaterial("metalMid", {
          roughness: 0.6,
          metalness: 0.5,
        });
        for (const x of [-1, 1]) {
          for (const z of [-1, 1]) {
            const post = new Mesh(new BoxGeometry(0.1, 1.4, 0.1), stMat);
            post.position.set(
              x * (length * 0.42),
              deckY + 0.7,
              z * (bodyWidth / 2 - 0.15),
            );
            this.group.add(post);
          }
        }
        break;
      }
      case "van": {
        const van = new Mesh(
          new BoxGeometry(length * 0.9, 1.9, bodyWidth),
          cargoMat,
        );
        van.position.set(0, deckY + 0.95, 0);
        van.castShadow = true;
        van.receiveShadow = true;
        this.group.add(van);
        // A curved roof cap.
        const roof = new Mesh(
          new BoxGeometry(length * 0.9, 0.2, bodyWidth + 0.2),
          paletteMaterial("roofDark", { roughness: 0.85 }),
        );
        roof.position.set(0, deckY + 1.95, 0);
        this.group.add(roof);
        break;
      }
    }
  }

  updateWheels(groundSpeed: number, dt: number): void {
    // Wagons are unpowered, so their wheels never slip — always roll at the
    // ground speed (slip ratio 1).
    for (const ws of this.wheelSets) ws.update(groundSpeed, 1, dt);
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
}
