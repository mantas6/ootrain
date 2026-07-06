/**
 * Discrete UI / event one-shots + snapshot transition detection.
 *
 * Two responsibilities:
 *   1. {@link detectAudioEvents} — a **pure** function that diffs two
 *      consecutive snapshots and returns the discrete audio events that should
 *      fire (station entered, cargo accepted, money gained, repaired, refuelled,
 *      won, failed). Keeping this pure means the sim/UI stay untouched and the
 *      transition logic is trivially unit tested with no AudioContext.
 *   2. {@link UiAudio} — plays short procedural one-shots for those events:
 *      arrival chime, cargo clunk, repair thunk, purchase/money blip, failure
 *      sting, win fanfare.
 */

import type { GameSnapshot } from "../game/simulation/types";
import { getNoiseBuffer, playEnvelope } from "./noise";

/** A discrete audio event derived from a snapshot transition. */
export type AudioEvent =
  | "station-entered"
  | "cargo-accepted"
  | "money-gained"
  | "repaired"
  | "refuelled"
  | "won"
  | "failed";

/** Money must rise by at least this much to count as a "gain" blip. */
const MONEY_EPSILON = 1;
/** Damage must drop by at least this to count as a repair. */
const REPAIR_EPSILON = 0.02;
/** Fuel must rise by at least this (litres) to count as a refuel. */
const REFUEL_EPSILON = 1;

/**
 * Diffs two snapshots and returns the discrete events to play (pure, testable).
 *
 * `prev` is null on the very first frame (nothing to compare → no events).
 * Order is stable for deterministic tests.
 */
export function detectAudioEvents(
  prev: GameSnapshot | null,
  cur: GameSnapshot,
): AudioEvent[] {
  if (!prev) return [];
  const events: AudioEvent[] = [];

  // Entered a station's interaction range (edge, false → true).
  if (!prev.station.inRange && cur.station.inRange) {
    events.push("station-entered");
  }

  // Accepted cargo (coupled a new job).
  if (cur.cargo.length > prev.cargo.length) {
    events.push("cargo-accepted");
  }

  // Repaired (damage dropped meaningfully).
  const damageDrop =
    prev.damage - cur.damage + (prev.wheelDamage - cur.wheelDamage);
  if (damageDrop >= REPAIR_EPSILON) {
    events.push("repaired");
  }

  // Refuelled (fuel rose meaningfully).
  if (cur.fuelLitres - prev.fuelLitres >= REFUEL_EPSILON) {
    events.push("refuelled");
  }

  // Money increased (reward / delivery blip).
  if (cur.money - prev.money >= MONEY_EPSILON) {
    events.push("money-gained");
  }

  // Run outcome edges.
  if (prev.runState === "running" && cur.runState === "won") {
    events.push("won");
  } else if (prev.runState === "running" && cur.runState === "failed") {
    events.push("failed");
  }

  return events;
}

/** Plays short procedural one-shots for discrete game events. */
export class UiAudio {
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  /** Plays every event in the list. */
  play(events: readonly AudioEvent[]): void {
    for (const e of events) this.playOne(e);
  }

  private playOne(event: AudioEvent): void {
    switch (event) {
      case "station-entered":
        this.chime([660, 990], 0.12);
        break;
      case "cargo-accepted":
        this.clunk();
        break;
      case "money-gained":
        this.blip([880, 1320], 0.1);
        break;
      case "repaired":
        this.thunk();
        break;
      case "refuelled":
        this.blip([440, 660], 0.09);
        break;
      case "won":
        this.fanfare();
        break;
      case "failed":
        this.sting();
        break;
    }
  }

  /** Rising two-note bell for station arrival. */
  private chime(freqs: number[], gain: number): void {
    const now = this.ctx.currentTime;
    freqs.forEach((f, i) => this.tone("sine", f, gain, now + i * 0.1, 0.35));
  }

  /** Quick ascending blip for money / confirmations. */
  private blip(freqs: number[], gain: number): void {
    const now = this.ctx.currentTime;
    freqs.forEach((f, i) =>
      this.tone("triangle", f, gain, now + i * 0.06, 0.14),
    );
  }

  /** Low woody clunk for a cargo coupling. */
  private clunk(): void {
    const now = this.ctx.currentTime;
    this.tone("sine", 130, 0.22, now, 0.18);
    this.noiseHit(now, 220, 0.12, 0.12);
  }

  /** Metallic wrench thunk for a repair. */
  private thunk(): void {
    const now = this.ctx.currentTime;
    this.tone("square", 200, 0.14, now, 0.1);
    this.noiseHit(now, 1800, 0.1, 0.08);
  }

  /** Short triumphant arpeggio for a win. */
  private fanfare(): void {
    const now = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047]; // C E G C
    notes.forEach((f, i) =>
      this.tone("triangle", f, 0.16, now + i * 0.12, 0.45),
    );
  }

  /** Descending dissonant sting for failure. */
  private sting(): void {
    const now = this.ctx.currentTime;
    const notes = [330, 262, 196];
    notes.forEach((f, i) =>
      this.tone("sawtooth", f, 0.16, now + i * 0.16, 0.5),
    );
  }

  private tone(
    type: OscillatorType,
    freq: number,
    peak: number,
    at: number,
    dur: number,
  ): void {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.destination);
    const end = playEnvelope(gain.gain, at, peak, 0.01, dur);
    osc.start(at);
    osc.stop(end + 0.05);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private noiseHit(
    at: number,
    filterFreq: number,
    peak: number,
    dur: number,
  ): void {
    const src = this.ctx.createBufferSource();
    src.buffer = getNoiseBuffer(this.ctx);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = 1;
    const gain = this.ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);
    const end = playEnvelope(gain.gain, at, peak, 0.005, dur);
    src.start(at);
    src.stop(end + 0.05);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}
