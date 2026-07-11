import { describe, expect, it } from "vitest";

import {
  BRAKE_KEY_LEVEL,
  THROTTLE_NOTCH,
  THROTTLE_RAMP_PER_S,
  createControlState,
  rampHeldThrottle,
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

  it("a fresh W press gives one notch and latches the up-ramp; auto-repeat does not re-notch", () => {
    const state = drive([down("w"), down("w", true), down("w", true)]);
    // Only the fresh press nudges; repeats just keep the held flag set so the
    // time-based ramp (rampHeldThrottle) takes over.
    expect(state.throttle).toBeCloseTo(THROTTLE_NOTCH, 6);
    expect(state.throttleUpHeld).toBe(true);
  });

  it("releasing W clears the up-ramp latch", () => {
    const state = drive([down("w"), up("w")]);
    expect(state.throttleUpHeld).toBe(false);
    expect(state.throttle).toBeCloseTo(THROTTLE_NOTCH, 6);
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

describe("rampHeldThrottle (hold-to-accelerate)", () => {
  it("ramps up while the up key is held, by rate * dt", () => {
    const held = drive([down("w")]); // throttle = one notch, up latched
    const dt = 0.1;
    const next = rampHeldThrottle(held, dt);
    expect(next.throttle).toBeCloseTo(
      THROTTLE_NOTCH + THROTTLE_RAMP_PER_S * dt,
      6,
    );
  });

  it("ramps down while the down key is held and clamps at 0", () => {
    const held: ControlState = {
      ...createControlState(),
      throttleDownHeld: true,
      throttle: 0.05,
    };
    const next = rampHeldThrottle(held, 1); // 0.05 - 0.6 -> clamp 0
    expect(next.throttle).toBe(0);
  });

  it("clamps at 1 over a long hold", () => {
    let state = drive([down("ArrowUp")]);
    // Simulate ~2s of holding at 60 Hz.
    for (let i = 0; i < 120; i++) state = rampHeldThrottle(state, 1 / 60);
    expect(state.throttle).toBe(1);
  });

  it("does nothing (same reference) when no throttle key is held", () => {
    const idle = createControlState();
    expect(rampHeldThrottle(idle, 0.1)).toBe(idle);
  });

  it("does nothing when both throttle keys are held (cancel out)", () => {
    const both: ControlState = {
      ...createControlState(),
      throttleUpHeld: true,
      throttleDownHeld: true,
      throttle: 0.5,
    };
    expect(rampHeldThrottle(both, 0.1)).toBe(both);
  });

  it("a full sweep from 0 takes roughly 1.5-2s of holding", () => {
    let state = drive([up("w"), down("w")]); // latch up (starts at one notch)
    state = { ...state, throttle: 0 }; // start the sweep at zero for timing
    let seconds = 0;
    while (state.throttle < 1 && seconds < 5) {
      state = rampHeldThrottle(state, 1 / 60);
      seconds += 1 / 60;
    }
    expect(seconds).toBeGreaterThan(1.4);
    expect(seconds).toBeLessThan(2.1);
  });
});
