import { describe, it, expect } from "vitest";
import {
  framingDistance,
  referenceExtent,
  visibleExtent,
} from "./cameraFraming";

/** Matches the rig's tuned defaults. */
const FOV = 48;
const REFERENCE_DISTANCE = 46;
const REFERENCE_ASPECT = 16 / 9;

const EXTENT = referenceExtent(REFERENCE_DISTANCE, FOV, REFERENCE_ASPECT);

const IPAD_LANDSCAPE = 4 / 3;
const IPAD_PORTRAIT = 3 / 4;

describe("framingDistance", () => {
  it("reproduces the tuned desktop distance at the reference aspect", () => {
    expect(framingDistance(REFERENCE_ASPECT, FOV, EXTENT)).toBeCloseTo(
      REFERENCE_DISTANCE,
      6,
    );
  });

  it("does not zoom in on aspects wider than the reference (desktop unchanged)", () => {
    // Ultrawide: vertical extent dominates, so distance stays at the desktop
    // value — the wide-aspect look is never regressed / cropped.
    for (const aspect of [REFERENCE_ASPECT, 2, 21 / 9, 3]) {
      expect(framingDistance(aspect, FOV, EXTENT)).toBeCloseTo(
        REFERENCE_DISTANCE,
        6,
      );
    }
  });

  it("zooms out on narrower aspects to keep the train framed", () => {
    const landscape = framingDistance(IPAD_LANDSCAPE, FOV, EXTENT);
    const portrait = framingDistance(IPAD_PORTRAIT, FOV, EXTENT);
    expect(landscape).toBeGreaterThan(REFERENCE_DISTANCE);
    expect(portrait).toBeGreaterThan(landscape);
  });

  it("keeps the full desktop width visible at 16:9, 4:3, and 3:4", () => {
    // Whatever horizontal extent the desktop framing shows must remain visible
    // (never cropped) at the squarer/portrait iPad aspects.
    for (const aspect of [REFERENCE_ASPECT, IPAD_LANDSCAPE, IPAD_PORTRAIT]) {
      const dist = framingDistance(aspect, FOV, EXTENT);
      const shown = visibleExtent(dist, FOV, aspect);
      expect(shown.halfWidth + 1e-9).toBeGreaterThanOrEqual(EXTENT.halfWidth);
      expect(shown.halfHeight + 1e-9).toBeGreaterThanOrEqual(EXTENT.halfHeight);
    }
  });

  it("falls back to the height fit for a non-positive aspect", () => {
    const heightOnly = EXTENT.halfHeight / Math.tan((FOV * Math.PI) / 360);
    expect(framingDistance(0, FOV, EXTENT)).toBeCloseTo(heightOnly, 6);
    expect(framingDistance(-1, FOV, EXTENT)).toBeCloseTo(heightOnly, 6);
  });
});

describe("visibleExtent", () => {
  it("scales half-width with aspect and is inverse to framingDistance", () => {
    const wide = visibleExtent(REFERENCE_DISTANCE, FOV, REFERENCE_ASPECT);
    const square = visibleExtent(REFERENCE_DISTANCE, FOV, 1);
    // Same distance/FOV → same vertical extent, narrower aspect → less width.
    expect(square.halfHeight).toBeCloseTo(wide.halfHeight, 6);
    expect(square.halfWidth).toBeLessThan(wide.halfWidth);
  });
});
