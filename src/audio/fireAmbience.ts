/**
 * Fire ambience — the dread bed that grows as the fire closes in.
 *
 * Two long-lived layers, both driven by distance-to-fire:
 *   - a low "wind/roar" bed (low-passed noise) that provides body,
 *   - crackle bursts (a self-scheduled high-passed noise envelope) whose rate
 *     and loudness increase as the fire nears.
 *
 * The snapshot's `fireDistanceM` is positive when the fire is behind the train.
 * Loudness scales inversely with distance ({@link distanceToIntensity}) so the
 * bed is silent when the fire is far and roars when it is right behind — a pure
 * curve that is unit tested.
 */

import type { GameSnapshot } from "../game/simulation/types";
import {
  createLoopingNoise,
  getNoiseBuffer,
  playEnvelope,
  rampGainTo,
} from "./noise";

/** Distance (m) at/beyond which the fire is inaudible. */
const FAR_M = 2500;
/** Distance (m) at/below which the fire is at full intensity. */
const NEAR_M = 200;
/** Peak wind-bed gain. */
const WIND_GAIN = 0.12;

/**
 * Maps fire distance (m, positive = behind) to intensity 0..1 (pure, testable).
 * 0 when far, 1 when very close; clamps outside [NEAR_M, FAR_M].
 */
export function distanceToIntensity(fireDistanceM: number): number {
  const d = Math.abs(fireDistanceM);
  if (d >= FAR_M) return 0;
  if (d <= NEAR_M) return 1;
  return 1 - (d - NEAR_M) / (FAR_M - NEAR_M);
}

/** Owns the wind bed + self-scheduled crackle bursts. */
export class FireAmbience {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly windSrc: AudioBufferSourceNode;
  private readonly windFilter: BiquadFilterNode;
  private readonly windGain: GainNode;

  private intensity = 0;
  private crackleTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(destination);

    // Low wind/roar bed.
    this.windSrc = createLoopingNoise(ctx, 0xf1_5e_00_00);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 380;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);

    this.windSrc.start(ctx.currentTime);
    this.scheduleCrackle();
  }

  /** Reacts to a fresh snapshot: sets intensity from fire distance. */
  update(snapshot: GameSnapshot): void {
    this.intensity = distanceToIntensity(snapshot.fireDistanceM);
    const now = this.ctx.currentTime;
    rampGainTo(this.windGain, WIND_GAIN * this.intensity, now, 0.4);
  }

  /** Self-scheduled crackle burst; rate/loudness track intensity. */
  private crackle = (): void => {
    if (this.disposed) return;
    if (this.intensity > 0.02) {
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = getNoiseBuffer(this.ctx, 0xc0ffee);
      // Randomize playback offset so each burst differs.
      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 1400 + Math.random() * 1600;
      const gain = this.ctx.createGain();
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      const peak = 0.06 * this.intensity * (0.6 + Math.random() * 0.4);
      const end = playEnvelope(gain.gain, now, peak, 0.004, 0.09);
      src.start(now);
      src.stop(end + 0.05);
      src.onended = () => {
        src.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    }
    // Closer fire = faster crackle (80ms..600ms), plus jitter.
    const base = 600 - this.intensity * 500;
    const next = base + Math.random() * 200;
    this.crackleTimer = setTimeout(this.crackle, next);
  };

  private scheduleCrackle(): void {
    this.crackleTimer = setTimeout(this.crackle, 300);
  }

  /** Stops the wind bed and crackle scheduler. */
  dispose(): void {
    this.disposed = true;
    if (this.crackleTimer !== null) {
      clearTimeout(this.crackleTimer);
      this.crackleTimer = null;
    }
    try {
      this.windSrc.stop(this.ctx.currentTime);
    } catch {
      // Already stopped.
    }
    this.windSrc.disconnect();
    this.windFilter.disconnect();
    this.windGain.disconnect();
    this.master.disconnect();
  }
}
