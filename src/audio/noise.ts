/**
 * Shared Web Audio helpers for the procedural audio layer.
 *
 * These are low-level utilities used by every sound subsystem:
 *   - {@link getNoiseBuffer}: a cached, seeded white-noise {@link AudioBuffer}
 *     so subsystems can reuse one buffer instead of allocating per node.
 *   - {@link rampTo} / {@link rampGainTo}: click-free parameter changes via
 *     `setTargetAtTime` with a sensible smoothing time constant.
 *   - {@link playEnvelope}: a one-shot attack/decay gain envelope helper used by
 *     discrete effects (UI blips, brake-release hiss, warning beeps).
 *
 * All helpers take an {@link AudioContext} explicitly; nothing here touches a
 * global context, so importing this module in Node/tests is side-effect free.
 * The seeded noise generator mirrors the sim's mulberry32 so buffers are
 * deterministic (satisfies the "reproducible audio" rule — the recipe is code).
 */

/** One second of noise is plenty to loop / window without audible seams. */
const NOISE_SECONDS = 1;

/** Cache keyed by AudioContext so we build one shared buffer per context. */
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/**
 * Deterministic mulberry32 float stream in [0, 1) — same algorithm the sim
 * uses, so generated noise is reproducible from the seed alone.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a shared, cached mono white-noise buffer for the context.
 *
 * The buffer is generated once per context from a fixed seed so the noise bed
 * is deterministic and cheap to reuse across every subsystem.
 */
export function getNoiseBuffer(
  ctx: BaseAudioContext,
  seed = 0x9e3779b9,
): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;

  const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rand = mulberry32(seed);
  for (let i = 0; i < length; i++) {
    // Map [0,1) -> [-1,1) for a symmetric noise signal.
    data[i] = rand() * 2 - 1;
  }
  noiseCache.set(ctx, buffer);
  return buffer;
}

/**
 * Creates a looping noise source wired through a filter/gain the caller owns.
 * The returned source is already started; callers stop/disconnect it on dispose.
 */
export function createLoopingNoise(
  ctx: BaseAudioContext,
  seed?: number,
): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx, seed);
  src.loop = true;
  return src;
}

/**
 * Smoothly ramps an {@link AudioParam} toward a target using `setTargetAtTime`.
 *
 * `setTargetAtTime` approaches the target exponentially and never produces the
 * discontinuities that cause clicks. `timeConstant` is the time (seconds) to
 * cover ~63% of the remaining distance; small values react quickly, larger
 * values glide.
 */
export function rampTo(
  param: AudioParam,
  target: number,
  now: number,
  timeConstant = 0.08,
): void {
  param.setTargetAtTime(target, now, Math.max(0.001, timeConstant));
}

/** Convenience: ramp a gain node's gain to a target (click-free). */
export function rampGainTo(
  gain: GainNode,
  target: number,
  now: number,
  timeConstant = 0.08,
): void {
  rampTo(gain.gain, target, now, timeConstant);
}

/**
 * Applies a one-shot attack/decay envelope to a gain param, starting `at`.
 *
 * Uses linear attack then exponential-ish decay (via `setTargetAtTime`) to a
 * near-zero floor. Returns the time the envelope has effectively finished so
 * callers can schedule node stop() slightly after.
 */
export function playEnvelope(
  gainParam: AudioParam,
  at: number,
  peak: number,
  attack: number,
  decay: number,
): number {
  gainParam.cancelScheduledValues(at);
  gainParam.setValueAtTime(0.0001, at);
  gainParam.linearRampToValueAtTime(peak, at + attack);
  // Exponential decay toward a small floor; target-at-time avoids a hard stop.
  gainParam.setTargetAtTime(0.0001, at + attack, Math.max(0.01, decay / 3));
  return at + attack + decay;
}
