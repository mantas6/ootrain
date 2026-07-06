/**
 * Camera rig for the 2.5D view.
 *
 * Default behaviour is a smooth side-follow: the camera tracks the train's
 * X position and elevation from a fixed offset down the +Z axis, so the world
 * scrolls past in profile. The player can:
 *   - drag to orbit / pan around the current focus (inspect the train),
 *   - wheel to zoom in/out.
 *
 * Orbit is clamped so the player can't drop the camera underground or spin it
 * fully behind the world, and zoom is clamped to a sane close/far band. This
 * never turns into free 3D steering — the train still only moves along X.
 *
 * The rig owns a {@link PerspectiveCamera} and (optionally) attaches pointer /
 * wheel handlers to a DOM element. Constructing the rig needs no GL context;
 * `attach` is only called at runtime with a real canvas.
 */

import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from "three";

/** Tuning knobs for the camera rig. */
export interface CameraConfig {
  /** Distance from focus at default zoom, metres. */
  distance?: number;
  /** Min / max zoom distance, metres. */
  minDistance?: number;
  maxDistance?: number;
  /** Height of the look-at focus above the track, metres. */
  focusLift?: number;
  /** Follow smoothing factor per second (higher = snappier). */
  followLerp?: number;
  /** Polar-angle clamp (radians from +Y). Keeps the camera above ground. */
  minPolar?: number;
  maxPolar?: number;
}

const DEFAULTS: Required<CameraConfig> = {
  distance: 46,
  minDistance: 12,
  maxDistance: 150,
  focusLift: 4,
  followLerp: 3.2,
  minPolar: 0.35, // near-top-down limit
  maxPolar: 1.5, // just above the horizon (can't go underground)
};

/** A follow-camera rig with orbit + zoom. */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  private readonly cfg: Required<CameraConfig>;

  /** Smoothed world-space focus point the camera orbits/looks at. */
  private readonly focus = new Vector3(0, 0, 0);
  /** Target focus (driven by the train each frame). */
  private readonly targetFocus = new Vector3(0, 0, 0);

  /** Orbit orientation + distance around the focus. */
  private readonly orbit = new Spherical(DEFAULTS.distance, 1.32, Math.PI / 2);
  private targetDistance = DEFAULTS.distance;

  // Pointer-drag state.
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private element: HTMLElement | null = null;

  // Bound handlers (stored so we can detach cleanly).
  private readonly onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.element?.setPointerCapture(e.pointerId);
  };
  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    // Drag right → orbit around +Y; drag up → raise the camera.
    this.orbit.theta -= dx * 0.005;
    this.orbit.phi = MathUtils.clamp(
      this.orbit.phi - dy * 0.005,
      this.cfg.minPolar,
      this.cfg.maxPolar,
    );
  };
  private readonly onPointerUp = (e: PointerEvent): void => {
    this.dragging = false;
    try {
      this.element?.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer may already be released; ignore.
    }
  };
  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.001);
    this.targetDistance = MathUtils.clamp(
      this.targetDistance * factor,
      this.cfg.minDistance,
      this.cfg.maxDistance,
    );
  };

  constructor(aspect = 1, config: CameraConfig = {}) {
    this.cfg = { ...DEFAULTS, ...config };
    this.orbit.radius = this.cfg.distance;
    this.targetDistance = this.cfg.distance;
    this.camera = new PerspectiveCamera(48, aspect, 0.5, 5000);
    this.camera.position.set(0, 20, this.cfg.distance);
  }

  /** Attaches pointer + wheel handlers to a DOM element (idempotent-ish). */
  attach(element: HTMLElement): void {
    this.detach();
    this.element = element;
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    element.addEventListener("wheel", this.onWheel, { passive: false });
  }

  /** Removes any attached handlers. */
  detach(): void {
    const el = this.element;
    if (!el) return;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("wheel", this.onWheel);
    this.element = null;
  }

  /** Updates the camera aspect ratio for a new viewport size. */
  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Sets the world-space point the camera follows (usually the loco position
   * with a small lift). Call once per frame before {@link update}.
   */
  setTarget(x: number, y: number, z = 0): void {
    this.targetFocus.set(x, y + this.cfg.focusLift, z);
  }

  /**
   * Advances the smooth follow + applies orbit / zoom. `dt` is seconds since
   * the last frame. Positions the camera on the orbit sphere around the focus.
   */
  update(dt: number): void {
    // Exponential smoothing toward the target focus and zoom distance.
    const k = 1 - Math.exp(-this.cfg.followLerp * dt);
    this.focus.lerp(this.targetFocus, k);
    this.orbit.radius += (this.targetDistance - this.orbit.radius) * k;
    this.orbit.makeSafe();

    const offset = new Vector3().setFromSpherical(this.orbit);
    this.camera.position.copy(this.focus).add(offset);
    this.camera.lookAt(this.focus);
  }

  /** Immediately snaps the focus (no smoothing) — useful on first frame. */
  snapTo(x: number, y: number, z = 0): void {
    this.setTarget(x, y, z);
    this.focus.copy(this.targetFocus);
    this.orbit.radius = this.targetDistance;
    const offset = new Vector3().setFromSpherical(this.orbit);
    this.camera.position.copy(this.focus).add(offset);
    this.camera.lookAt(this.focus);
  }
}
