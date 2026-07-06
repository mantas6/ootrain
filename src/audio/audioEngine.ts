/**
 * AudioEngine — the audio layer's single entry point.
 *
 * Owns the {@link AudioContext}, a master gain (mute/volume live here), and all
 * sound subsystems (engine, wheels, brakes, slip, warnings, fire, UI). It is a
 * pure consumer of {@link GameSnapshot}s: {@link update} fans a snapshot out to
 * each subsystem, and {@link UiAudio} is fired for discrete events detected by
 * diffing consecutive snapshots — the sim/UI stay untouched.
 *
 * Browser autoplay policy requires an {@link AudioContext} be created/resumed
 * from a user gesture, so construction is deferred until {@link unlock} is
 * called (from a pointer/keydown handler). Every method is a no-op until then,
 * which also makes importing/using this class in Node/tests safe: if there is
 * no `AudioContext` constructor available, {@link unlock} simply does nothing.
 */

import type { GameSnapshot } from "../game/simulation/types";
import { EngineAudio } from "./engineAudio";
import { WheelAudio } from "./wheelAudio";
import { BrakeAudio } from "./brakeAudio";
import { SlipAudio } from "./slipAudio";
import { WarningAudio } from "./warningAudio";
import { FireAmbience } from "./fireAmbience";
import { UiAudio, detectAudioEvents } from "./uiAudio";

/** Resolves the platform AudioContext constructor if present (else null). */
function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Assembled, running subsystems (only exists after unlock). */
interface AudioGraph {
  ctx: AudioContext;
  master: GainNode;
  engine: EngineAudio;
  wheels: WheelAudio;
  brakes: BrakeAudio;
  slip: SlipAudio;
  warnings: WarningAudio;
  fire: FireAmbience;
  ui: UiAudio;
}

/** Default master volume (0..1) applied when unmuted. */
const DEFAULT_VOLUME = 0.8;

export class AudioEngine {
  private graph: AudioGraph | null = null;
  private muted = false;
  private volume = DEFAULT_VOLUME;
  private prevSnapshot: GameSnapshot | null = null;

  /** True once the AudioContext exists and is (or is becoming) running. */
  get isUnlocked(): boolean {
    return this.graph !== null;
  }

  /** Current mute state. */
  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Lazily creates the AudioContext + graph on the first user gesture.
   * Safe to call repeatedly; resumes a suspended context each time. No-op when
   * no AudioContext is available (Node/tests).
   */
  unlock(): void {
    if (this.graph) {
      void this.graph.ctx.resume();
      return;
    }
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume;
    master.connect(ctx.destination);

    this.graph = {
      ctx,
      master,
      engine: new EngineAudio(ctx, master),
      wheels: new WheelAudio(ctx, master),
      brakes: new BrakeAudio(ctx, master),
      slip: new SlipAudio(ctx, master),
      warnings: new WarningAudio(ctx, master),
      fire: new FireAmbience(ctx, master),
      ui: new UiAudio(ctx, master),
    };

    void ctx.resume();
  }

  /** Sets master volume 0..1 (persists across mute toggles). */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyMasterGain();
  }

  /** Sets mute on/off. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
  }

  /** Toggles mute; returns the new state. */
  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private applyMasterGain(): void {
    if (!this.graph) return;
    const now = this.graph.ctx.currentTime;
    const target = this.muted ? 0 : this.volume;
    // Short ramp avoids a click when muting/unmuting.
    this.graph.master.gain.setTargetAtTime(target, now, 0.02);
  }

  /**
   * Fans a fresh snapshot out to every subsystem and fires event one-shots.
   * `dt` is the elapsed time (seconds) since the previous update (for the brake
   * deceleration heuristic). No-op until unlocked.
   */
  update(snapshot: GameSnapshot, dt: number): void {
    const g = this.graph;
    if (!g) return;

    // Discrete events from the snapshot transition (pure diff).
    const events = detectAudioEvents(this.prevSnapshot, snapshot);
    if (events.length > 0) g.ui.play(events);

    g.engine.update(snapshot);
    g.wheels.update(snapshot);
    g.brakes.update(snapshot, dt);
    g.slip.update(snapshot);
    g.warnings.update(snapshot);
    g.fire.update(snapshot);

    this.prevSnapshot = snapshot;
  }

  /** Stops/disconnects every node and closes the context. */
  dispose(): void {
    const g = this.graph;
    if (!g) return;
    g.engine.dispose();
    g.wheels.dispose();
    g.brakes.dispose();
    g.slip.dispose();
    g.warnings.dispose();
    g.fire.dispose();
    g.master.disconnect();
    void g.ctx.close();
    this.graph = null;
    this.prevSnapshot = null;
  }
}
