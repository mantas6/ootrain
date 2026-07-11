/**
 * Keyboard controls — framework-free driving input for the game loop.
 *
 * This module is split into two layers so the mapping logic is testable
 * without a DOM:
 *
 *   - {@link ControlState} + {@link reduceControl} — a *pure* reducer that
 *     folds discrete key events into a persistent, notch-style control state.
 *     A fresh W/S press nudges throttle a single notch (fine control); holding
 *     the key latches a ramp direction so throttle sweeps continuously via
 *     {@link rampHeldThrottle} (see below). Brake is a hold, and
 *     reverse/interact/map/pause/mute are edge-triggered toggles/pulses. No
 *     timers, no globals — deterministic.
 *   - {@link rampHeldThrottle} — a *pure*, time-based helper that advances the
 *     throttle toward its limit while a throttle key is held, given `dt`. This
 *     is what makes holding W/↑ feel smooth (full 0→1 sweep in ~1.7s) instead of
 *     relying on sluggish OS key-repeat. Kept pure so it is unit-tested with a
 *     fixed `dt`.
 *   - {@link KeyboardController} — a thin class that attaches `keydown`/`keyup`
 *     listeners, feeds them through the reducer, exposes {@link
 *     KeyboardController.update} to apply the held-key ramp each frame, and
 *     (crucially) shares the same mutable control state the on-screen sliders
 *     read/write, so keyboard and UI stay a single source of truth.
 *
 * Key map (per docs/02-gameplay.md "Controls", extended):
 *
 *   | Key            | Action                                    |
 *   | -------------- | ----------------------------------------- |
 *   | W / ArrowUp    | Increase throttle (tap = notch, hold ramp)|
 *   | S / ArrowDown  | Decrease throttle (tap = notch, hold ramp)|
 *   | Space          | Brake (hold)                              |
 *   | R              | Toggle reverse (edge)                     |
 *   | E              | Interact with station (pulse)             |
 *   | Tab / M        | Toggle map (Tab default prevented)        |
 *   | P / Escape     | Toggle pause                              |
 *   | N              | Toggle mute                               |
 *
 * The on-screen mute button remains as an alternative to N.
 */

/** How much one throttle notch changes the 0..1 throttle value (single tap). */
export const THROTTLE_NOTCH = 0.05;
/**
 * How fast a *held* throttle key sweeps the 0..1 throttle, per second. At 0.6/s
 * a full 0→1 sweep takes ~1.7s of holding — mainstream "hold to accelerate".
 */
export const THROTTLE_RAMP_PER_S = 0.6;
/** Brake level applied while the brake key is held. */
export const BRAKE_KEY_LEVEL = 1;

/**
 * The persistent, continuously-read control state. Throttle/brake/reverse are
 * the values the game loop turns into a {@link TrainAction} each step and that
 * the on-screen sliders mirror. The `edges` are one-shot intents consumed (and
 * cleared) by the loop each frame.
 */
export interface ControlState {
  /** Persistent throttle demand, 0..1 (notch-adjusted + held-key ramp). */
  throttle: number;
  /** Persistent brake demand, 0..1 (held keys / slider). */
  brake: number;
  /** Whether reverse is currently selected. */
  reverse: boolean;
  /**
   * Whether the throttle-up key (W / ↑) is currently held. Latches a positive
   * ramp direction consumed by {@link rampHeldThrottle} each frame.
   */
  throttleUpHeld: boolean;
  /** Whether the throttle-down key (S / ↓) is currently held (negative ramp). */
  throttleDownHeld: boolean;
  /** One-shot intents raised by an edge and cleared once handled. */
  edges: ControlEdges;
}

/** One-shot intents (rising-edge presses) awaiting consumption by the loop. */
export interface ControlEdges {
  /** Toggle reverse direction. */
  reverse: boolean;
  /** Interact with the nearby station. */
  interact: boolean;
  /** Toggle the map overlay. */
  toggleMap: boolean;
  /** Toggle pause. */
  togglePause: boolean;
  /** Toggle mute. */
  toggleMute: boolean;
}

/** A minimal, DOM-free description of a key event (testable). */
export interface KeyEventLike {
  /** Event type. */
  type: "keydown" | "keyup";
  /** `KeyboardEvent.key` value. */
  key: string;
  /** Whether this keydown is an OS auto-repeat (held key). */
  repeat?: boolean;
}

/** Creates a fresh, zeroed control state. */
export function createControlState(): ControlState {
  return {
    throttle: 0,
    brake: 0,
    reverse: false,
    throttleUpHeld: false,
    throttleDownHeld: false,
    edges: createEdges(),
  };
}

/** Creates a fresh, all-false edge set. */
export function createEdges(): ControlEdges {
  return {
    reverse: false,
    interact: false,
    toggleMap: false,
    togglePause: false,
    toggleMute: false,
  };
}

/** Normalizes a key to a canonical action token, or null if unmapped. */
function classifyKey(key: string): ControlKey | null {
  switch (key) {
    case "w":
    case "W":
    case "ArrowUp":
      return "throttleUp";
    case "s":
    case "S":
    case "ArrowDown":
      return "throttleDown";
    case " ":
    case "Spacebar": // legacy
      return "brake";
    case "r":
    case "R":
      return "reverse";
    case "e":
    case "E":
      return "interact";
    case "Tab":
    case "m":
    case "M":
      return "map";
    case "p":
    case "P":
    case "Escape":
      return "pause";
    case "n":
    case "N":
      return "mute";
    default:
      return null;
  }
}

type ControlKey =
  | "throttleUp"
  | "throttleDown"
  | "brake"
  | "reverse"
  | "interact"
  | "map"
  | "pause"
  | "mute";

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Pure reducer: folds a single key event into the control state, returning a
 * new state (never mutates the input).
 *
 * Throttle keys are hold-to-accelerate: a *fresh* press nudges a single notch
 * (fine control for tapping) and latches the ramp direction; the continuous
 * sweep while held is applied separately by {@link rampHeldThrottle} on a
 * per-frame timer. Auto-repeat `keydown`s only keep the held flag set — they do
 * *not* nudge again (the smooth ramp replaces sluggish OS key-repeat) and never
 * re-fire edge toggles.
 */
export function reduceControl(
  state: ControlState,
  event: KeyEventLike,
): ControlState {
  const control = classifyKey(event.key);
  if (control === null) return state;

  const isDown = event.type === "keydown";
  const isRepeat = event.repeat === true;

  switch (control) {
    case "throttleUp": {
      if (!isDown) return { ...state, throttleUpHeld: false };
      // Auto-repeat: keep the ramp latched, don't re-nudge.
      if (isRepeat) {
        return state.throttleUpHeld
          ? state
          : { ...state, throttleUpHeld: true };
      }
      return {
        ...state,
        throttleUpHeld: true,
        throttle: clamp01(state.throttle + THROTTLE_NOTCH),
      };
    }
    case "throttleDown": {
      if (!isDown) return { ...state, throttleDownHeld: false };
      if (isRepeat) {
        return state.throttleDownHeld
          ? state
          : { ...state, throttleDownHeld: true };
      }
      return {
        ...state,
        throttleDownHeld: true,
        throttle: clamp01(state.throttle - THROTTLE_NOTCH),
      };
    }
    case "brake": {
      // Hold-to-brake: down applies, up releases.
      return { ...state, brake: isDown ? BRAKE_KEY_LEVEL : 0 };
    }
    case "reverse": {
      if (!isDown || isRepeat) return state;
      return {
        ...state,
        reverse: !state.reverse,
        edges: { ...state.edges, reverse: true },
      };
    }
    case "interact": {
      if (!isDown || isRepeat) return state;
      return { ...state, edges: { ...state.edges, interact: true } };
    }
    case "map": {
      if (!isDown || isRepeat) return state;
      return { ...state, edges: { ...state.edges, toggleMap: true } };
    }
    case "pause": {
      if (!isDown || isRepeat) return state;
      return { ...state, edges: { ...state.edges, togglePause: true } };
    }
    case "mute": {
      if (!isDown || isRepeat) return state;
      return { ...state, edges: { ...state.edges, toggleMute: true } };
    }
  }
}

/**
 * Pure, time-based throttle ramp: advances the throttle toward its limit while
 * a throttle key is held, by {@link THROTTLE_RAMP_PER_S} × `dtSeconds`. If no
 * throttle key is held (or both are, cancelling out), the state is returned
 * unchanged (same reference), so callers can cheaply skip re-notifying the UI.
 *
 * Deterministic: no clocks, no globals — pass a fixed `dt` in tests.
 */
export function rampHeldThrottle(
  state: ControlState,
  dtSeconds: number,
): ControlState {
  const direction =
    (state.throttleUpHeld ? 1 : 0) - (state.throttleDownHeld ? 1 : 0);
  if (direction === 0 || dtSeconds <= 0) return state;
  const next = clamp01(
    state.throttle + direction * THROTTLE_RAMP_PER_S * dtSeconds,
  );
  if (next === state.throttle) return state;
  return { ...state, throttle: next };
}

/** Keys whose default browser behaviour we suppress while playing. */
function shouldPreventDefault(key: string): boolean {
  // Tab would move focus off the canvas; arrows/space scroll the page.
  return (
    key === "Tab" || key === " " || key === "ArrowUp" || key === "ArrowDown"
  );
}

/** Callbacks the controller invokes on rising edges (loop wiring). */
export interface ControllerCallbacks {
  /** Called after any change so subscribers (UI) can re-read the state. */
  onChange?: (state: ControlState) => void;
}

/**
 * Attaches keyboard listeners and maintains a shared {@link ControlState}.
 *
 * The controller owns *one* mutable state object; both the keyboard and the
 * on-screen sliders write into it through the same methods, keeping input a
 * single source of truth. The game loop reads {@link getState} each step and
 * calls {@link consumeEdges} to drain one-shot intents.
 */
export class KeyboardController {
  private state: ControlState = createControlState();
  private readonly onChange?: (state: ControlState) => void;
  private attached = false;

  constructor(callbacks: ControllerCallbacks = {}) {
    this.onChange = callbacks.onChange;
  }

  /** Attaches `keydown`/`keyup` listeners to `target` (default `window`). */
  attach(target: EventTarget = window): void {
    if (this.attached) return;
    this.attached = true;
    this.target = target;
    target.addEventListener("keydown", this.handleKeyDown);
    target.addEventListener("keyup", this.handleKeyUp);
  }

  /** Detaches listeners. Safe to call when not attached. */
  detach(): void {
    if (!this.attached || !this.target) return;
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.attached = false;
    this.target = null;
  }

  private target: EventTarget | null = null;

  private readonly handleKeyDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (shouldPreventDefault(e.key)) e.preventDefault();
    this.apply({ type: "keydown", key: e.key, repeat: e.repeat });
  };

  private readonly handleKeyUp = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    this.apply({ type: "keyup", key: e.key });
  };

  /** Feeds one event through the pure reducer and stores the result. */
  private apply(event: KeyEventLike): void {
    const next = reduceControl(this.state, event);
    if (next !== this.state) {
      this.state = next;
      this.onChange?.(this.state);
    }
  }

  /** Returns the live control state (read each loop step). */
  getState(): ControlState {
    return this.state;
  }

  /**
   * Applies the held-key throttle ramp for an elapsed `dtSeconds`. Call once per
   * frame/step from the loop; notifies the UI only when the value actually
   * changes (i.e. while W/S is held), keeping the on-screen sliders in sync.
   */
  update(dtSeconds: number): void {
    const next = rampHeldThrottle(this.state, dtSeconds);
    if (next !== this.state) {
      this.state = next;
      this.onChange?.(this.state);
    }
  }

  /** Sets the throttle directly (from the on-screen slider). */
  setThrottle(value: number): void {
    this.state = { ...this.state, throttle: clamp01(value) };
    this.onChange?.(this.state);
  }

  /** Sets the brake directly (from the on-screen slider). */
  setBrake(value: number): void {
    this.state = { ...this.state, brake: clamp01(value) };
    this.onChange?.(this.state);
  }

  /** Toggles reverse (from the on-screen button); raises the reverse edge. */
  toggleReverse(): void {
    this.state = {
      ...this.state,
      reverse: !this.state.reverse,
      edges: { ...this.state.edges, reverse: true },
    };
    this.onChange?.(this.state);
  }

  /** Raises the interact edge (from the on-screen button). */
  interact(): void {
    this.state = {
      ...this.state,
      edges: { ...this.state.edges, interact: true },
    };
    this.onChange?.(this.state);
  }

  /**
   * Returns the pending edges and clears them on the shared state, so each
   * one-shot intent is handled exactly once by the loop.
   */
  consumeEdges(): ControlEdges {
    const edges = this.state.edges;
    this.state = { ...this.state, edges: createEdges() };
    return edges;
  }

  /** Resets all control values to zero/false (used on restart). */
  reset(): void {
    this.state = createControlState();
    this.onChange?.(this.state);
  }
}
