/**
 * Alarms — the loudest, most attention-grabbing layer in the mix.
 *
 * A single self-scheduling timer decides which alarm (if any) is active from
 * the latest snapshot and emits periodic beeps. Because there is exactly one
 * timer and each cycle re-reads the current state, alarms never stack or leave
 * a stuck tone: changing state simply changes the next beep.
 *
 * Alarm tiers (highest priority first):
 *   - temperature "critical": urgent two-tone alarm (softened triangle timbre),
 *   - temperature "warning": gentle single sine beep — noticeable, not nagging,
 *   - low fuel: distinct low "ping",
 *   - low time: a short high "tick".
 *
 * The priority + interval selection is a pure function ({@link selectAlarm})
 * that is unit tested; the audio side only schedules beeps.
 */

import type { GameSnapshot } from "../game/simulation/types";
import { playEnvelope } from "./noise";

/** Fuel fraction at/below which the low-fuel ping sounds. */
const LOW_FUEL_FRACTION = 0.15;
/** Seconds at/below which the low-time tick sounds. */
const LOW_TIME_S = 30;

/** A resolved alarm to play, or null for silence. */
export interface AlarmSpec {
  kind: "critical" | "warning" | "low-fuel" | "low-time";
  /** Seconds between beeps. */
  interval: number;
  /** Beep base frequency, Hz. */
  freq: number;
  /** Beep peak gain. */
  gain: number;
  /** Two-tone (harsh) vs single tone. */
  twoTone: boolean;
  /** Oscillator timbre — sine/triangle are softer than square. */
  waveform: OscillatorType;
  /** Beep length, seconds. */
  dur: number;
  /** Envelope attack, seconds (longer = gentler, less clicky onset). */
  attack: number;
}

/**
 * Resolves the single active alarm from a snapshot (pure, testable).
 * Returns null when nothing should be alarming.
 */
export function selectAlarm(snapshot: GameSnapshot): AlarmSpec | null {
  if (snapshot.runState !== "running") return null;

  if (snapshot.temperatureState === "critical") {
    return {
      kind: "critical",
      interval: 0.5,
      freq: 880,
      gain: 0.12,
      twoTone: true,
      waveform: "triangle",
      dur: 0.1,
      attack: 0.01,
    };
  }
  if (snapshot.temperatureState === "warning") {
    return {
      kind: "warning",
      interval: 1.6,
      freq: 560,
      gain: 0.07,
      twoTone: false,
      waveform: "sine",
      dur: 0.14,
      attack: 0.02,
    };
  }

  const fuelFraction =
    snapshot.fuelCapacity > 0 ? snapshot.fuelLitres / snapshot.fuelCapacity : 1;
  if (fuelFraction <= LOW_FUEL_FRACTION) {
    return {
      kind: "low-fuel",
      interval: 1.6,
      freq: 300,
      gain: 0.13,
      twoTone: false,
      waveform: "square",
      dur: 0.12,
      attack: 0.005,
    };
  }

  if (snapshot.timeRemainingS <= LOW_TIME_S) {
    return {
      kind: "low-time",
      interval: 1.0,
      freq: 1200,
      gain: 0.1,
      twoTone: false,
      waveform: "square",
      dur: 0.12,
      attack: 0.005,
    };
  }

  return null;
}

/** Schedules non-stacking alarm beeps from the latest snapshot. */
export class WarningAudio {
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;
  private current: GameSnapshot | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
    this.scheduleNext();
  }

  /** Store the latest snapshot; the timer reads it on its own cadence. */
  update(snapshot: GameSnapshot): void {
    this.current = snapshot;
  }

  /** One timer tick: play the current alarm (if any) then reschedule. */
  private tick = (): void => {
    if (this.disposed) return;
    const alarm = this.current ? selectAlarm(this.current) : null;
    if (alarm) {
      this.playBeep(alarm);
      this.timer = setTimeout(this.tick, alarm.interval * 1000);
    } else {
      // Nothing active — poll again shortly for state changes.
      this.timer = setTimeout(this.tick, 200);
    }
  };

  private scheduleNext(): void {
    this.timer = setTimeout(this.tick, 200);
  }

  /** Emits one short beep (or a two-tone pair for critical). */
  private playBeep(alarm: AlarmSpec): void {
    const now = this.ctx.currentTime;
    this.tone(now, alarm.freq, alarm.gain, alarm);
    if (alarm.twoTone) {
      this.tone(now + alarm.dur + 0.02, alarm.freq * 0.75, alarm.gain, alarm);
    }
  }

  private tone(at: number, freq: number, peak: number, alarm: AlarmSpec): void {
    const osc = this.ctx.createOscillator();
    osc.type = alarm.waveform;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.destination);
    const end = playEnvelope(gain.gain, at, peak, alarm.attack, alarm.dur);
    osc.start(at);
    osc.stop(end + 0.05);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Stops the timer; any in-flight beeps stop themselves. */
  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
