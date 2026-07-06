/**
 * Station model: platform, station building, and a name sign board.
 *
 * Built from primitives and placed at a station's world X (from the sim data)
 * on the track elevation. The name sign uses a small canvas-drawn texture so
 * the station name is legible in the world without bundling a font atlas —
 * canvas texture creation is guarded so it degrades to a blank board when no
 * 2D canvas is available (tests / SSR), keeping construction context-free.
 */

import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Texture,
} from "three";
import { paletteMaterial } from "../palette";
import { getElevationAt } from "../../game/data";

/**
 * Draws a station-name label onto a canvas and returns a texture, or null if a
 * canvas 2D context isn't available (non-DOM environments).
 */
function makeSignTexture(name: string): Texture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#1c1f22";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e8dcc0";
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, canvas.width / 2, canvas.height / 2, canvas.width - 40);
  const tex = new CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

/** A placed station model. */
export class StationModel {
  readonly group: Group;

  constructor(name: string, positionX: number) {
    this.group = new Group();
    this.group.name = `station:${name}`;
    const y = getElevationAt(positionX);
    this.group.position.set(positionX, y, 0);

    this.buildPlatform();
    this.buildBuilding();
    this.buildSign(name);
  }

  /** A raised platform beside the track (positive Z side). */
  private buildPlatform(): void {
    const mat = paletteMaterial("concrete", { roughness: 0.95 });
    const platform = new Mesh(new BoxGeometry(26, 0.6, 4), mat);
    platform.position.set(0, 0.55, 4.2);
    platform.receiveShadow = true;
    platform.castShadow = true;
    this.group.add(platform);

    // A canopy roof over part of the platform on posts.
    const roofMat = paletteMaterial("roof", { roughness: 0.85 });
    const roof = new Mesh(new BoxGeometry(12, 0.25, 4.4), roofMat);
    roof.position.set(-3, 3.4, 4.2);
    roof.castShadow = true;
    this.group.add(roof);
    const postMat = paletteMaterial("metalPole", { roughness: 0.8 });
    for (const x of [-8, 2]) {
      for (const z of [2.4, 6]) {
        const post = new Mesh(new BoxGeometry(0.18, 2.8, 0.18), postMat);
        post.position.set(x, 1.9, z);
        this.group.add(post);
      }
    }
  }

  /** A small station building at one end of the platform. */
  private buildBuilding(): void {
    const wallMat = paletteMaterial("buildingWarm", { roughness: 0.9 });
    const roofMat = paletteMaterial("roofDark", { roughness: 0.85 });
    const body = new Mesh(new BoxGeometry(6, 3.2, 4), wallMat);
    body.position.set(9, 2.2, 4.5);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);
    const roof = new Mesh(new BoxGeometry(6.6, 0.3, 4.6), roofMat);
    roof.position.set(9, 3.95, 4.5);
    roof.castShadow = true;
    this.group.add(roof);
    // Door + windows.
    const winMat = paletteMaterial("window", { roughness: 0.3 });
    const door = new Mesh(new BoxGeometry(1, 2, 0.1), winMat);
    door.position.set(9, 1.6, 2.55);
    this.group.add(door);
  }

  /** A sign board on two posts carrying the station name. */
  private buildSign(name: string): void {
    const postMat = paletteMaterial("metalPole", { roughness: 0.8 });
    for (const x of [-4, 4]) {
      const post = new Mesh(new BoxGeometry(0.16, 3, 0.16), postMat);
      post.position.set(x, 1.5, 2);
      this.group.add(post);
    }
    const tex = makeSignTexture(name);
    const boardMat = tex
      ? new MeshBasicMaterial({ map: tex })
      : paletteMaterial("building", { roughness: 0.9, emissive: 0x101214 });
    const board = new Mesh(new BoxGeometry(8, 2, 0.15), boardMat);
    board.position.set(0, 3.2, 2);
    this.group.add(board);
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mat = mesh.material as MeshBasicMaterial;
        if (mat.map) mat.map.dispose();
      }
    });
  }
}
