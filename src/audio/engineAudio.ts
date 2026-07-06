/**
 * Diesel engine loop — the always-on heart of the mix.
 *
 * The engine is built from long-lived nodes with parameter automation (never
 * per-frame allocation):
 *   - a low sawtooth "block" oscillator for the fundamental rumble,
 *   - a detuned second sawtooth an octave up for body/harmonics,
 *   - a low-pass filtered noise layer for combustion "grit",
 *   - a shared master gain, all routed to the destination the caller provides.
 *
 * Pitch and loudness follow an estimated **engine load**. The snapshot does not
 * expose throttle directly, so {@link estimateEngineLoad} derives a proxy from
 * temperature-above-ambient, grade demand and speed — heat and climbing both
 * imply the engine is working. Load maps to frequency/gain via pure curves
 * ({@link loadToFrequency}, {@link loadToGain}) that are unit tested.
 *
 * Damage roughens the sound: it deepens noise grit and adds pitch wobble via a
 * slow LFO on the fundamental so a beaten engine sounds ragged.
 */

import type { GameSnapshot } from "../game/simulation/types";
import { createLoopingNoise, rampTo, rampGainTo } from "./noise";

/** Idle fundamental, Hz (engine at rest). */
const IDLE_FREQ = 42;
/** Fundamental at full load, Hz. */
const FULL_FREQ = 96;
/** Master engine gain at idle (quiet — engine sits under alarms). */
const IDLE_GAIN = 0.05;
/** Master engine gain at full load. */
const FULL_GAIN = 0.16;
/** Speed (m/s) at which the speed contribution to load saturates. */
const LOAD_SPEED_FULL = 30;
/** Approximate ambient temperature, °C (load baseline). */
const AMBIENT_C = 20;
/** Temperature above ambient (°C) that reads as "working hard". */
const LOAD_TEMP_SPAN = 90;

/**
 * Estimates engine load in 0..1 from a snapshot (pure, testable).
 *
 * Blends three proxies for "how hard the engine is working":
 *   - heat above ambient (sustained power → heat),
 *   - uphill grade demand (climbing needs power),
 *   - speed (fast running keeps the engine spun up).
 * Slip also implies wasted full power, so it pins load high.
 */
export function estimateEngineLoad(snapshot: GameSnapshot): number {
  const heat = clamp01((snapshot.temperatureC - AMBIENT_C) / LOAD_TEMP_SPAN);
  const gradeDemand = clamp01(snapshot.grade / 0.06); // steep climb ≈ full
  const speedTerm = clamp01(Math.abs(snapshot.speed) / LOAD_SPEED_FULL);
  const slipTerm = snapshot.tractionState === "slipping" ? 0.85 : 0;

  // Weighted blend; heat dominates because it is the persistent load signal.
  const blended = 0.45 * heat + 0.3 * gradeDemand + 0.25 * speedTerm;
  return clamp01(Math.max(blended, slipTerm));
}

/** Maps load 0..1 to the fundamental frequency in Hz (pure, testable). */
export function loadToFrequency(load: number): number {
  return IDLE_FREQ + (FULL_FREQ - IDLE_FREQ) * clamp01(load);
}

/** Maps load 0..1 to the engine master gain (pure, testable). */
export function loadToGain(load: number): number {
  return IDLE_GAIN + (FULL_GAIN - IDLE_GAIN) * clamp01(load);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Owns and animates the engine loop nodes. */
export class EngineAudio {
  private readonly ctx: AudioContext;
  private readonly osc1: OscillatorNode;
  private readonly osc2: OscillatorNode;
  private readonly noiseSrc: AudioBufferSourceNode;
  private readonly noiseFilter: BiquadFilterNode;
  private readonly noiseGain: GainNode;
  private readonly wobbleLfo: OscillatorNode;
  private readonly wobbleGain: GainNode;
  private readonly master: GainNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    const now = ctx.currentTime;

    this.master = ctx.createGain();
    this.master.gain.value = IDLE_GAIN;
    this.master.connect(destination);

    // Fundamental + octave body.
    this.osc1 = ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc1.frequency.value = IDLE_FREQ;

    this.osc2 = ctx.createOscillator();
    this.osc2.type = "sawtooth";
    this.osc2.frequency.value = IDLE_FREQ * 2;
    this.osc2.detune.value = 8;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.6;
    this.osc1.connect(oscGain);
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.25;
    this.osc2.connect(osc2Gain);
    oscGain.connect(this.master);
    osc2Gain.connect(this.master);

    // Combustion grit: low-passed noise layer.
    this.noiseSrc = createLoopingNoise(ctx);
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = "lowpass";
    this.noiseFilter.frequency.value = 320;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.08;
    this.noiseSrc.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.master);

    // Damage wobble: slow LFO nudging the fundamental frequency.
    this.wobbleLfo = ctx.createOscillator();
    this.wobbleLfo.type = "sine";
    this.wobbleLfo.frequency.value = 6;
    this.wobbleGain = ctx.createGain();
    this.wobbleGain.gain.value = 0; // silent until damaged
    this.wobbleLfo.connect(this.wobbleGain);
    this.wobbleGain.connect(this.osc1.frequency);

    this.osc1.start(now);
    this.osc2.start(now);
    this.noiseSrc.start(now);
    this.wobbleLfo.start(now);
  }

  /** Reacts to a fresh snapshot. Called from the engine's update fan-out. */
  update(snapshot: GameSnapshot): void {
    const now = this.ctx.currentTime;
    const load = estimateEngineLoad(snapshot);
    const freq = loadToFrequency(load);
    const gain = loadToGain(load);

    // Smooth ramps — no clicks even on abrupt load jumps.
    rampTo(this.osc1.frequency, freq, now, 0.15);
    rampTo(this.osc2.frequency, freq * 2, now, 0.15);
    rampGainTo(this.master, gain, now, 0.2);

    // High load opens the grit filter and lifts the noise layer (strain).
    const strain = clamp01((load - 0.6) / 0.4);
    rampTo(this.noiseFilter.frequency, 320 + strain * 900, now, 0.2);
    rampGainTo(this.noiseGain, 0.08 + strain * 0.12, now, 0.2);

    // Damage: rougher grit + audible pitch wobble.
    const damage = clamp01(Math.max(snapshot.damage, snapshot.wheelDamage));
    rampTo(this.wobbleGain.gain, damage * 6, now, 0.3);
    rampTo(this.wobbleLfo.frequency, 5 + damage * 7, now, 0.3);
  }

  /** Stops and disconnects every node. */
  dispose(): void {
    const now = this.ctx.currentTime;
    for (const src of [this.osc1, this.osc2, this.noiseSrc, this.wobbleLfo]) {
      try {
        src.stop(now);
      } catch {
        // Already stopped — ignore.
      }
      src.disconnect();
    }
    this.noiseFilter.disconnect();
    this.noiseGain.disconnect();
    this.wobbleGain.disconnect();
    this.master.disconnect();
  }
}
