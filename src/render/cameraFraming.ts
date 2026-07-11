/**
 * Pure camera-framing math (no Three.js, no DOM/WebGL) so it stays testable
 * under Node/Vitest.
 *
 * The 2.5D view uses a {@link PerspectiveCamera} whose FOV is *vertical*: the
 * visible vertical extent is fixed for a given distance regardless of viewport
 * aspect, while the horizontal extent scales with aspect. Tuning the camera
 * distance for a wide desktop aspect (16:9) therefore cuts the (horizontally
 * long) train off at the sides on squarer/portrait viewports like an iPad
 * (4:3, or 3:4 in portrait), because the same distance shows far less width.
 *
 * The fix is to pick the camera distance so a *target world extent* stays fully
 * inside the frustum at any aspect: fit both the horizontal and vertical extent
 * and take the larger required distance. For aspects at or wider than the
 * reference (desktop) aspect the vertical extent dominates, so the distance is
 * unchanged; only narrower aspects pull the camera back to keep the train
 * framed.
 */

/** A world extent (half-sizes from the focus) that must stay visible. */
export interface FramingExtent {
  /** Half-width to keep visible, metres. */
  halfWidth: number;
  /** Half-height to keep visible, metres. */
  halfHeight: number;
}

/**
 * Tangent of half the vertical FOV. `fovDegrees` is the camera's vertical
 * field of view in degrees (Three.js `PerspectiveCamera.fov`).
 */
export function halfFovTan(fovDegrees: number): number {
  return Math.tan((fovDegrees * Math.PI) / 360);
}

/**
 * The world extent a perspective camera frames at a given distance/aspect —
 * the inverse of {@link framingDistance}. Handy for tests/assertions.
 */
export function visibleExtent(
  distance: number,
  fovDegrees: number,
  aspect: number,
): FramingExtent {
  const halfHeight = distance * halfFovTan(fovDegrees);
  return { halfHeight, halfWidth: halfHeight * aspect };
}

/**
 * Distance a perspective camera (vertical `fovDegrees`, viewport `aspect`) must
 * sit from its focus so that `extent` fits fully inside the frustum. Fits both
 * axes and returns the larger of the two required distances. Guards against a
 * non-positive aspect (falls back to the height-only fit).
 */
export function framingDistance(
  aspect: number,
  fovDegrees: number,
  extent: FramingExtent,
): number {
  const t = halfFovTan(fovDegrees);
  const distForHeight = extent.halfHeight / t;
  if (!(aspect > 0)) return distForHeight;
  const distForWidth = extent.halfWidth / (t * aspect);
  return Math.max(distForHeight, distForWidth);
}

/**
 * Derives the target extent from a reference (desktop) framing: the world
 * width/height the reference distance shows at the reference aspect. Feeding
 * this extent back into {@link framingDistance} reproduces `referenceDistance`
 * exactly at `referenceAspect` (and for any wider aspect), so the tuned desktop
 * look is preserved while narrower aspects zoom out to avoid cropping.
 */
export function referenceExtent(
  referenceDistance: number,
  fovDegrees: number,
  referenceAspect: number,
): FramingExtent {
  return visibleExtent(referenceDistance, fovDegrees, referenceAspect);
}
