/**
 * Brake squeal + release hiss.
 *
 * While braking above a small speed, a resonant band-passed noise "squeal"
 * fades in; its pitch rises slightly with speed so hard stops sound tense. The
 * subsystem tracks the braking state internally (diffed from the snapshot) so
 * it can fire a short **release hiss** one-shot the moment braking stops while
 * still moving — the classic air-brake "pssht".
 *
 * The snapshot has no brake field, so braking is inferred: the train is
 * decelerating hard toward a stop while still carrying speed. That heuristic is
 * a pure function ({@link isBrakingHeuristic}) and is unit tested.
 */

import type { GameSnapshot } from "../game/simulation/types";
import {
  createLoopingNoise,
  getNoiseBuffer,
  playEnvelope,
  rampTo,
  rampGainTo,
} from "./noise";

/** Below this speed (m/s) braking makes no squeal. */
const MIN_SQUEAL_SPEED = 3;
/** Peak squeal gain. */
const SQUEAL_GAIN = 0.12;

/**
 * Heuristic for "the player is braking" from consecutive snapshots (pure).
 *
 * True when speed magnitude dropped meaningfully over `dt` while still moving —
 * i.e. active deceleration, not coasting. `dt` guards against divide-by-zero.
 */
export function isBrakingHeuristic(
  prevSpeed: number,
  curSpeed: number,
  dt: number,
): boolean {
  const speedMag = Math.abs(curSpeed);
  if (speedMag < MIN_SQUEAL_SPEED) return false;
  if (dt <= 0) return false;
  const decel = (Math.abs(prevSpeed) - speedMag) / dt; // m/s²
  return decel > 1.2;
}

/** Owns brake squeal (continuous) + release hiss (one-shot) nodes. */
export class BrakeAudio {
  private readonly ctx: AudioContext;
  private readonly squealSrc: AudioBufferSourceNode;
  private readonly squealFilter: BiquadFilterNode;
  private readonly squealGain: GainNode;
  private readonly master: GainNode;

  private prevSpeed = 0;
  private wasBraking = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(destination);

    // Resonant band-pass noise = metallic squeal.
    this.squealSrc = createLoopingNoise(ctx, 0x0bad_beef);
    this.squealFilter = ctx.createBiquadFilter();
    this.squealFilter.type = "bandpass";
    this.squealFilter.frequency.value = 2600;
    this.squealFilter.Q.value = 12;
    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    this.squealSrc.connect(this.squealFilter);
    this.squealFilter.connect(this.squealGain);
    this.squealGain.connect(this.master);

    this.squealSrc.start(ctx.currentTime);
  }

  /** Reacts to a fresh snapshot; fires the release hiss on brake-off. */
  update(snapshot: GameSnapshot, dt: number): void {
    const now = this.ctx.currentTime;
    const braking = isBrakingHeuristic(this.prevSpeed, snapshot.speed, dt);
    const speedMag = Math.abs(snapshot.speed);

    if (braking) {
      rampGainTo(this.squealGain, SQUEAL_GAIN, now, 0.05);
      // Higher speed → slightly higher squeal.
      rampTo(
        this.squealFilter.frequency,
        2200 + Math.min(speedMag, 30) * 30,
        now,
        0.1,
      );
    } else {
      rampGainTo(this.squealGain, 0, now, 0.12);
      // Just released while still rolling → air-hiss.
      if (this.wasBraking && speedMag > MIN_SQUEAL_SPEED) {
        this.playReleaseHiss(now);
      }
    }

    this.wasBraking = braking;
    this.prevSpeed = snapshot.speed;
  }

  /** Short pink-ish noise burst — the air-brake release. */
  private playReleaseHiss(now: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = getNoiseBuffer(this.ctx);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1800;
    const gain = this.ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    const end = playEnvelope(gain.gain, now, 0.14, 0.01, 0.35);
    src.start(now);
    src.stop(end + 0.05);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  /** Stops and disconnects the continuous nodes. */
  dispose(): void {
    try {
      this.squealSrc.stop(this.ctx.currentTime);
    } catch {
      // Already stopped.
    }
    this.squealSrc.disconnect();
    this.squealFilter.disconnect();
    this.squealGain.disconnect();
    this.master.disconnect();
  }
}
