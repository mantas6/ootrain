/**
 * Top-level renderer: wires the scene, camera rig, train, and streamed world
 * into one object driven by simulation snapshots.
 *
 * The world is streamed in fixed-width chunks around the train: track chunks
 * and terrain tiles are created as the train approaches and disposed once they
 * fall far behind, so memory/draw cost stays bounded on a long route. Stations
 * (fixed data) are created once and toggled by proximity. The fire front is a
 * single moving effect; terrain tiles behind it are rebuilt as burned variants.
 *
 * A caller supplies a container element and a snapshot provider. The internal
 * `requestAnimationFrame` loop pulls a fresh snapshot each frame and advances
 * everything by real elapsed time.
 *
 * Construction is split so that nothing touches WebGL until {@link mount} is
 * called with a real container — keeping imports safe for tests/build.
 */

import { Vector3, type WebGLRenderer } from "three";
import type { GameSnapshot } from "../game/simulation/types";
import { ROUTE_LENGTH_M, STATIONS } from "../game/data";
import { createRenderer, createScene, type SceneBundle } from "./scene";
import { CameraRig } from "./camera";
import { TrainView } from "./train/TrainView";
import { TrackChunk } from "./world/Track";
import { TerrainTile } from "./world/TerrainTile";
import { StationModel } from "./world/StationModel";
import { FireFrontView } from "./world/FireFrontView";
import { visibleChunkRange } from "./routeGeometry";
import { disposeSharedCaches } from "./palette";

/** Width of one world chunk / tile, metres. */
const CHUNK_SIZE = 200;
/** How many chunks to keep resident each side of the train. */
const CHUNK_RADIUS = 4;
/**
 * How many chunks to stream *before* the route start (x < 0). The train's head
 * sits at route X = 0 while its body (loco + trailing wagons, well under one
 * chunk) extends into negative X, so a pre-start buffer keeps ground/track
 * under the whole train instead of leaving it floating over the void.
 */
const PRE_START_CHUNKS = 1;

/** A snapshot source (usually `() => sim.getSnapshot()`). */
export type SnapshotProvider = () => GameSnapshot;

/** Handles the whole 3D world for one run. */
export class WorldView {
  private renderer: WebGLRenderer | null = null;
  private scene: SceneBundle | null = null;
  private rig: CameraRig | null = null;
  private train: TrainView | null = null;
  private fire: FireFrontView | null = null;
  private container: HTMLElement | null = null;

  private readonly trackChunks = new Map<number, TrackChunk>();
  private readonly terrainTiles = new Map<number, TerrainTile>();
  /** Whether a resident tile is currently the burned variant. */
  private readonly tileBurned = new Map<number, boolean>();
  private readonly stations: StationModel[] = [];

  private rafId = 0;
  private lastTime = 0;
  private readonly getSnapshot: SnapshotProvider;
  private readonly camPos = new Vector3();
  private readonly resizeObserver: ResizeObserver | null = null;

  constructor(getSnapshot: SnapshotProvider) {
    this.getSnapshot = getSnapshot;
    this.resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => this.handleResize())
        : null;
  }

  /**
   * Mounts the renderer into `container`, builds the scene/camera/train, and
   * starts the animation loop. Requires a real DOM + WebGL context.
   */
  mount(container: HTMLElement): void {
    this.container = container;
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;

    this.renderer = createRenderer();
    this.renderer.setSize(width, height, false);
    container.appendChild(this.renderer.domElement);

    this.scene = createScene();
    this.rig = new CameraRig(width / height);
    this.rig.attach(this.renderer.domElement);

    const snapshot = this.getSnapshot();
    this.train = new TrainView(snapshot);
    this.scene.scene.add(this.train.group);
    // Effects live in world space (not parented to the moving train group root).
    this.scene.scene.add(this.train.smoke.group);
    this.scene.scene.add(this.train.sparks.group);

    this.fire = new FireFrontView();
    this.scene.scene.add(this.fire.group);

    // Stations are fixed; build them all once.
    for (const st of STATIONS) {
      const model = new StationModel(st.name, st.positionX);
      this.stations.push(model);
      this.scene.scene.add(model.group);
    }

    this.rig.snapTo(snapshot.positionX, 4, 0);
    this.streamChunks(snapshot);

    this.resizeObserver?.observe(container);
    this.lastTime = performance.now();
    this.loop();
  }

  /** The rAF loop: pull a snapshot, advance, render. */
  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const snapshot = this.getSnapshot();
    this.update(snapshot, dt);
    this.render();
  };

  /**
   * Advances the world for one frame. Public so a caller can drive frames
   * manually (e.g. a fixed-step demo) instead of the internal rAF loop.
   */
  update(snapshot: GameSnapshot, dt: number): void {
    if (!this.scene || !this.rig || !this.train || !this.fire) return;

    this.streamChunks(snapshot);
    this.updateBurnedTiles(snapshot);

    this.train.update(snapshot, dt);
    // No fire mechanic → hide the fire wall and leave terrain unburned.
    this.fire.group.visible = snapshot.fireEnabled;
    if (snapshot.fireEnabled) {
      this.fire.update(snapshot.fireFrontX, dt);
    }

    // Camera follows the loco head position at track elevation.
    this.train.getFollowTarget(this.followTarget);
    this.rig.setTarget(this.followTarget.x, this.followTarget.y, 0);
    this.rig.update(dt);

    // Keep the sky centred on the camera and the sun following the train.
    this.rig.camera.getWorldPosition(this.camPos);
    this.scene.sky.position.copy(this.camPos);
    this.scene.sun.position.set(
      snapshot.positionX - 60,
      this.followTarget.y + 90,
      70,
    );
    this.scene.sun.target.position.set(
      snapshot.positionX,
      this.followTarget.y,
      0,
    );

    this.train.faceCamera(this.camPos);
  }

  private readonly followTarget = new Vector3();

  private render(): void {
    if (!this.renderer || !this.scene || !this.rig) return;
    this.renderer.render(this.scene.scene, this.rig.camera);
  }

  /** Creates chunks/tiles in range and disposes those outside it. */
  private streamChunks(snapshot: GameSnapshot): void {
    if (!this.scene) return;
    const { min, max } = visibleChunkRange(
      snapshot.positionX,
      CHUNK_SIZE,
      CHUNK_RADIUS,
      ROUTE_LENGTH_M,
      -PRE_START_CHUNKS,
    );

    // Create missing.
    for (let i = min; i <= max; i++) {
      if (!this.trackChunks.has(i)) {
        const chunk = new TrackChunk(i * CHUNK_SIZE, CHUNK_SIZE);
        this.trackChunks.set(i, chunk);
        this.scene.scene.add(chunk.group);
      }
      if (!this.terrainTiles.has(i)) {
        const burned = this.shouldBurn(i, snapshot);
        const tile = new TerrainTile(i, CHUNK_SIZE, ROUTE_LENGTH_M, burned);
        this.terrainTiles.set(i, tile);
        this.tileBurned.set(i, burned);
        this.scene.scene.add(tile.group);
      }
    }

    // Dispose out-of-range.
    for (const [i, chunk] of this.trackChunks) {
      if (i < min || i > max) {
        this.scene.scene.remove(chunk.group);
        chunk.dispose();
        this.trackChunks.delete(i);
      }
    }
    for (const [i, tile] of this.terrainTiles) {
      if (i < min || i > max) {
        this.scene.scene.remove(tile.group);
        tile.dispose();
        this.terrainTiles.delete(i);
        this.tileBurned.delete(i);
      }
    }
  }

  /** A chunk should be burned when its whole span is behind the fire front. */
  private shouldBurn(chunkIndex: number, snapshot: GameSnapshot): boolean {
    if (!snapshot.fireEnabled) return false;
    const chunkEnd = (chunkIndex + 1) * CHUNK_SIZE;
    return chunkEnd <= snapshot.fireFrontX;
  }

  /** Rebuilds resident tiles that have just fallen behind the fire front. */
  private updateBurnedTiles(snapshot: GameSnapshot): void {
    if (!this.scene) return;
    for (const [i, tile] of this.terrainTiles) {
      const shouldBurn = this.shouldBurn(i, snapshot);
      if (shouldBurn && this.tileBurned.get(i) !== true) {
        this.scene.scene.remove(tile.group);
        tile.dispose();
        const burnedTile = new TerrainTile(i, CHUNK_SIZE, ROUTE_LENGTH_M, true);
        this.terrainTiles.set(i, burnedTile);
        this.tileBurned.set(i, true);
        this.scene.scene.add(burnedTile.group);
      }
    }
  }

  private handleResize(): void {
    if (!this.renderer || !this.rig || !this.container) return;
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.rig.setAspect(width / height);
  }

  /** Stops the loop and frees all GPU resources. */
  dispose(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.resizeObserver?.disconnect();

    for (const chunk of this.trackChunks.values()) chunk.dispose();
    this.trackChunks.clear();
    for (const tile of this.terrainTiles.values()) tile.dispose();
    this.terrainTiles.clear();
    this.tileBurned.clear();
    for (const station of this.stations) station.dispose();
    this.stations.length = 0;

    this.train?.dispose();
    this.fire?.dispose();
    this.rig?.detach();
    this.scene?.dispose();
    disposeSharedCaches();

    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
