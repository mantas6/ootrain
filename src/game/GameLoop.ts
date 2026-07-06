/**
 * GameLoop — the real, framework-free owner of the fixed-timestep simulation.
 *
 * Extracted out of App.tsx (which previously held a demo loop with a scripted
 * driver). Responsibilities:
 *
 *   - Fixed-timestep sim ticking via an accumulator (default 60 Hz). Frame
 *     deltas are clamped so a backgrounded/refocused tab can't trigger a
 *     "spiral of death" of catch-up ticks.
 *   - Applying the current control state as a {@link TrainAction} before each
 *     sim step (so keyboard + on-screen sliders drive the same input), and
 *     draining one-shot control edges (reverse toggle, station interact).
 *   - Publishing snapshots to the UI on a modest cadence (~20 Hz) and to the
 *     audio layer, without re-rendering React every physics tick.
 *   - Pause/resume: while paused, {@link advance} performs no sim ticks and
 *     keeps `lastTime` fresh so resuming doesn't replay the paused gap.
 *
 * The class is decoupled from `requestAnimationFrame`: {@link advance} takes an
 * absolute timestamp, so tests drive it with fake times and a fake sim. A thin
 * {@link start}/{@link stop} pair wires it to rAF for the real app.
 */

import type { GameSnapshot, TrainAction } from "./simulation/types";

/** The subset of the sim the loop needs (satisfied by GameSimulation). */
export interface LoopSim {
  applyAction(action: TrainAction): void;
  tick(dtSeconds: number): void;
  getSnapshot(): GameSnapshot;
}

/**
 * A source of driving input for each step. Returns the persistent throttle /
 * brake / reverse values plus any one-shot edges to fold into the action.
 */
export interface ControlSource {
  /** Current persistent control values. */
  getState(): {
    throttle: number;
    brake: number;
    reverse: boolean;
  };
  /**
   * Returns and clears pending one-shot edges. Only `reverse` and `interact`
   * are gameplay actions; other edges (map/pause/mute) are handled by the shell
   * before {@link GameLoop.advance} runs, so this loop ignores them.
   */
  consumeEdges(): { reverse: boolean; interact: boolean };
}

/** Configuration for {@link GameLoop}. */
export interface GameLoopOptions {
  /** The simulation to drive. */
  sim: LoopSim;
  /** The control input source. */
  controls: ControlSource;
  /** Publish a snapshot to the UI (throttled). */
  publishUi: (snapshot: GameSnapshot) => void;
  /** Feed a snapshot + elapsed dt to the audio layer (throttled). */
  updateAudio?: (snapshot: GameSnapshot, dt: number) => void;
  /** Fixed sim timestep, seconds (default 1/60). */
  simDt?: number;
  /** UI/audio publish interval, seconds (default 1/20). */
  publishDt?: number;
  /** Max real delta consumed per frame, seconds (default 0.1 = 6 sim steps). */
  maxFrameDt?: number;
}

const DEFAULT_SIM_DT = 1 / 60;
const DEFAULT_PUBLISH_DT = 1 / 20;
const DEFAULT_MAX_FRAME_DT = 0.1;

export class GameLoop {
  private readonly sim: LoopSim;
  private readonly controls: ControlSource;
  private readonly publishUi: (snapshot: GameSnapshot) => void;
  private readonly updateAudio?: (snapshot: GameSnapshot, dt: number) => void;

  private readonly simDt: number;
  private readonly publishDt: number;
  private readonly maxFrameDt: number;

  private simAccumulator = 0;
  private publishAccumulator = 0;
  private paused = false;
  private lastTime: number | null = null;

  private rafId = 0;

  constructor(options: GameLoopOptions) {
    this.sim = options.sim;
    this.controls = options.controls;
    this.publishUi = options.publishUi;
    this.updateAudio = options.updateAudio;
    this.simDt = options.simDt ?? DEFAULT_SIM_DT;
    this.publishDt = options.publishDt ?? DEFAULT_PUBLISH_DT;
    this.maxFrameDt = options.maxFrameDt ?? DEFAULT_MAX_FRAME_DT;
  }

  /** Whether the loop is currently paused. */
  get isPaused(): boolean {
    return this.paused;
  }

  /** Pauses sim ticking (snapshots stop advancing). */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resumes sim ticking. The next {@link advance} treats the elapsed gap as if
   * no time passed (no catch-up burst), because {@link advance} refreshes
   * `lastTime` every call including while paused.
   */
  resume(): void {
    this.paused = false;
  }

  /** Toggles pause; returns the new paused state. */
  togglePause(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  /**
   * Advances the loop to absolute time `nowMs` (milliseconds). Computes the
   * clamped real delta since the previous call, runs fixed sim steps, applies
   * control input each step, and publishes on the modest cadence.
   *
   * While paused, no sim steps run and no time is accumulated; `lastTime` is
   * still updated so resuming continues from "now".
   */
  advance(nowMs: number): void {
    if (this.lastTime === null) {
      this.lastTime = nowMs;
      // Publish an initial snapshot so the UI shows the starting state.
      this.publishUi(this.sim.getSnapshot());
      return;
    }

    const elapsed = Math.min(this.maxFrameDt, (nowMs - this.lastTime) / 1000);
    this.lastTime = nowMs;

    if (this.paused || elapsed <= 0) return;

    this.simAccumulator += elapsed;
    this.publishAccumulator += elapsed;

    while (this.simAccumulator >= this.simDt) {
      this.applyControls();
      this.sim.tick(this.simDt);
      this.simAccumulator -= this.simDt;
    }

    if (this.publishAccumulator >= this.publishDt) {
      const snapshot = this.sim.getSnapshot();
      this.publishUi(snapshot);
      this.updateAudio?.(snapshot, this.publishAccumulator);
      this.publishAccumulator = 0;
    }
  }

  /** Builds the per-step action from the shared control state + edges. */
  private applyControls(): void {
    const { throttle, brake, reverse } = this.controls.getState();
    const edges = this.controls.consumeEdges();

    const action: TrainAction = { throttle, brake };
    // The reverse edge means "flip direction"; the control state already holds
    // the new value, so dispatch the current `reverse` when the edge fired.
    if (edges.reverse) {
      action.reverse = reverse;
    }
    if (edges.interact) {
      action.interact = true;
    }
    this.sim.applyAction(action);
  }

  /** Resets accumulators and timing (used after loading/restarting). */
  reset(): void {
    this.simAccumulator = 0;
    this.publishAccumulator = 0;
    this.lastTime = null;
  }

  /**
   * Starts a `requestAnimationFrame`-driven loop that calls {@link advance}
   * each frame. Returns nothing; call {@link stop} to cancel.
   */
  start(): void {
    if (typeof requestAnimationFrame === "undefined") return;
    const frame = (): void => {
      this.rafId = requestAnimationFrame(frame);
      this.advance(performance.now());
    };
    this.rafId = requestAnimationFrame(frame);
  }

  /** Cancels the rAF loop started by {@link start}. */
  stop(): void {
    if (this.rafId && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = 0;
  }
}
