/**
 * Rail clatter — the "clickety-clack" of wheels over rail joints.
 *
 * Rather than scheduling one node per click (expensive), this uses a single
 * long-lived square-wave LFO to gate a band-passed noise layer: the LFO's
 * frequency is the click rate, so raising it with speed produces faster
 * clatter. A little shared noise on the amplitude keeps repeats from sounding
 * mechanical. Below a speed threshold the layer fades to silence.
 *
 * The click rate is a pure function of speed ({@link speedToClickRate}) so it
 * can be reasoned about and tested without an AudioContext.
 */

import type { GameSnapshot } from "../game/simulation/types";
import { createLoopingNoise, rampTo, rampGainTo } from "./noise";

/** Below this speed (m/s) the clatter is silent. */
const MIN_SPEED = 1.5;
/** Speed (m/s) at which clatter loudness saturates. */
const FULL_SPEED = 28;
/** Click rate at MIN_SPEED, Hz. */
const MIN_RATE = 2;
/** Click rate at FULL_SPEED, Hz. */
const MAX_RATE = 24;
/** Peak clatter gain. */
const MAX_GAIN = 0.09;

/** Maps speed (m/s) to click/clack rate in Hz (pure, testable). */
export function speedToClickRate(speedMag: number): number {
  const t = clamp01((speedMag - MIN_SPEED) / (FULL_SPEED - MIN_SPEED));
  return MIN_RATE + (MAX_RATE - MIN_RATE) * t;
}

/** Maps speed (m/s) to clatter loudness 0..MAX_GAIN (pure, testable). */
export function speedToClatterGain(speedMag: number): number {
  if (speedMag < MIN_SPEED) return 0;
  const t = clamp01((speedMag - MIN_SPEED) / (FULL_SPEED - MIN_SPEED));
  return MAX_GAIN * t;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Owns and animates the rail-clatter nodes. */
export class WheelAudio {
  private readonly ctx: AudioContext;
  private readonly noiseSrc: AudioBufferSourceNode;
  private readonly bandpass: BiquadFilterNode;
  private readonly gateGain: GainNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoDepth: GainNode;
  private readonly master: GainNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(destination);

    // Band-passed noise gives the woody "tock" of a joint.
    this.noiseSrc = createLoopingNoise(ctx, 0x1234_5678);
    this.bandpass = ctx.createBiquadFilter();
    this.bandpass.type = "bandpass";
    this.bandpass.frequency.value = 900;
    this.bandpass.Q.value = 1.4;
    this.noiseSrc.connect(this.bandpass);

    // The gate turns the noise into discrete clicks. Its DC baseline is 0 and
    // the LFO pushes it up rhythmically.
    this.gateGain = ctx.createGain();
    this.gateGain.gain.value = 0;
    this.bandpass.connect(this.gateGain);
    this.gateGain.connect(this.master);

    this.lfo = ctx.createOscillator();
    this.lfo.type = "square";
    this.lfo.frequency.value = MIN_RATE;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0.5; // square swings the gate 0..~1
    this.lfo.connect(this.lfoDepth);
    this.lfoDepth.connect(this.gateGain.gain);

    const now = ctx.currentTime;
    this.noiseSrc.start(now);
    this.lfo.start(now);
  }

  /** Reacts to a fresh snapshot. */
  update(snapshot: GameSnapshot): void {
    const now = this.ctx.currentTime;
    const speedMag = Math.abs(snapshot.speed);
    rampTo(this.lfo.frequency, speedToClickRate(speedMag), now, 0.25);
    rampGainTo(this.master, speedToClatterGain(speedMag), now, 0.2);
  }

  /** Stops and disconnects every node. */
  dispose(): void {
    const now = this.ctx.currentTime;
    for (const src of [this.noiseSrc, this.lfo]) {
      try {
        src.stop(now);
      } catch {
        // Already stopped.
      }
      src.disconnect();
    }
    this.bandpass.disconnect();
    this.gateGain.disconnect();
    this.lfoDepth.disconnect();
    this.master.disconnect();
  }
}
