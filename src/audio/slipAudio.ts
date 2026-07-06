/**
 * Wheel-slip screech.
 *
 * When the traction slice reports "slipping", spinning wheels throw a harsh
 * high resonant screech. A single long-lived band-pass noise layer with a very
 * high Q sits silent until slip; its gain and centre frequency scale with the
 * slip ratio so a brief slip is a chirp while a sustained heavy slip is a loud,
 * rising screech. A slow LFO warbles the pitch so it sounds like tortured metal
 * rather than a pure tone.
 *
 * The gain curve is pure ({@link slipToGain}) and unit tested.
 */

import type { GameSnapshot } from "../game/simulation/types";
import { createLoopingNoise, rampTo, rampGainTo } from "./noise";

/** Peak screech gain at maximum slip. */
const MAX_GAIN = 0.14;
/** Slip ratio at/above which the screech is at full intensity. */
const FULL_SLIP_RATIO = 1.6;

/**
 * Maps traction state + slip ratio to screech gain 0..MAX_GAIN (pure).
 * Silent unless actively slipping; ratio ≥ 1 is at the grip limit.
 */
export function slipToGain(state: string, slipRatio: number): number {
  if (state !== "slipping") return 0;
  const t = clamp01((slipRatio - 1) / (FULL_SLIP_RATIO - 1));
  // A small floor so slip onset is immediately audible.
  return MAX_GAIN * (0.35 + 0.65 * t);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Owns and animates the slip-screech nodes. */
export class SlipAudio {
  private readonly ctx: AudioContext;
  private readonly noiseSrc: AudioBufferSourceNode;
  private readonly bandpass: BiquadFilterNode;
  private readonly gain: GainNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoDepth: GainNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(destination);

    this.noiseSrc = createLoopingNoise(ctx, 0x5eed_face);
    this.bandpass = ctx.createBiquadFilter();
    this.bandpass.type = "bandpass";
    this.bandpass.frequency.value = 3400;
    this.bandpass.Q.value = 18;
    this.noiseSrc.connect(this.bandpass);
    this.bandpass.connect(this.gain);

    // Warble the centre frequency for a tortured-metal feel.
    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 14;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 400;
    this.lfo.connect(this.lfoDepth);
    this.lfoDepth.connect(this.bandpass.frequency);

    const now = ctx.currentTime;
    this.noiseSrc.start(now);
    this.lfo.start(now);
  }

  /** Reacts to a fresh snapshot. */
  update(snapshot: GameSnapshot): void {
    const now = this.ctx.currentTime;
    const target = slipToGain(snapshot.tractionState, snapshot.slipRatio);
    rampGainTo(this.gain, target, now, 0.04);
    // Heavier slip → higher pitch centre.
    const ratioT = clamp01((snapshot.slipRatio - 1) / (FULL_SLIP_RATIO - 1));
    rampTo(this.bandpass.frequency, 3200 + ratioT * 1600, now, 0.08);
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
    this.lfoDepth.disconnect();
    this.gain.disconnect();
  }
}
