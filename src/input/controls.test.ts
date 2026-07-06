import { describe, expect, it } from "vitest";

import {
  BRAKE_KEY_LEVEL,
  THROTTLE_NOTCH,
  createControlState,
  reduceControl,
  type ControlState,
  type KeyEventLike,
} from "./controls";

/** Folds a sequence of events through the pure reducer. */
function drive(events: KeyEventLike[]): ControlState {
  let state = createControlState();
  for (const e of events) state = reduceControl(state, e);
  return state;
}

const down = (key: string, repeat = false): KeyEventLike => ({
  type: "keydown",
  key,
  repeat,
});
const up = (key: string): KeyEventLike => ({ type: "keyup", key });

describe("controls reducer", () => {
  it("W / ArrowUp nudge throttle up by a notch (and clamp at 1)", () => {
    expect(drive([down("w")]).throttle).toBeCloseTo(THROTTLE_NOTCH, 6);
    expect(drive([down("ArrowUp"), down("ArrowUp")]).throttle).toBeCloseTo(
      THROTTLE_NOTCH * 2,
      6,
    );
    // Many presses saturate at 1.
    const many = Array.from({ length: 100 }, () => down("w"));
    expect(drive(many).throttle).toBe(1);
  });

  it("S / ArrowDown nudge throttle down (and clamp at 0)", () => {
    const state = drive([down("w"), down("w"), down("w"), down("s")]);
    expect(state.throttle).toBeCloseTo(THROTTLE_NOTCH * 2, 6);
    expect(drive([down("ArrowDown")]).throttle).toBe(0);
  });

  it("auto-repeat keydown keeps ramping throttle (held key)", () => {
    const state = drive([down("w"), down("w", true), down("w", true)]);
    expect(state.throttle).toBeCloseTo(THROTTLE_NOTCH * 3, 6);
  });

  it("Space is a hold-to-brake (down applies, up releases)", () => {
    expect(drive([down(" ")]).brake).toBe(BRAKE_KEY_LEVEL);
    expect(drive([down(" "), up(" ")]).brake).toBe(0);
  });

  it("R toggles reverse on each fresh press and raises an edge", () => {
    const once = drive([down("r")]);
    expect(once.reverse).toBe(true);
    expect(once.edges.reverse).toBe(true);

    const twice = drive([down("r"), up("r"), down("r")]);
    expect(twice.reverse).toBe(false);
  });

  it("R auto-repeat does not re-toggle reverse", () => {
    const state = drive([down("r"), down("r", true), down("r", true)]);
    expect(state.reverse).toBe(true); // only the first press toggled
  });

  it("E raises a one-shot interact edge on fresh press only", () => {
    expect(drive([down("e")]).edges.interact).toBe(true);
    expect(drive([down("e", true)]).edges.interact).toBe(false);
  });

  it("Tab and M both raise the map toggle edge", () => {
    expect(drive([down("Tab")]).edges.toggleMap).toBe(true);
    expect(drive([down("m")]).edges.toggleMap).toBe(true);
  });

  it("P and Escape both raise the pause toggle edge", () => {
    expect(drive([down("p")]).edges.togglePause).toBe(true);
    expect(drive([down("Escape")]).edges.togglePause).toBe(true);
  });

  it("N raises the mute toggle edge", () => {
    expect(drive([down("n")]).edges.toggleMute).toBe(true);
  });

  it("ignores unmapped keys and never mutates the input state", () => {
    const initial = createControlState();
    const next = reduceControl(initial, down("z"));
    expect(next).toBe(initial); // unchanged reference
  });
});
