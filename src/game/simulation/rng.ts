/**
 * Tiny deterministic pseudo-random number generator (mulberry32).
 *
 * The simulation must be fully reproducible for tests and balancing, so any
 * randomness routes through a seeded PRNG rather than `Math.random`. mulberry32
 * is a compact, well-distributed 32-bit generator that is more than good enough
 * for gameplay jitter (traction noise, cooling variation, etc.).
 *
 * The generator is stateful; its internal state is a single 32-bit integer.
 * {@link serializeRng} / {@link deserializeRng} let save/load round-trip the
 * exact stream position so a restored game continues identically.
 */

/** A seeded random source producing floats in [0, 1). */
export interface Rng {
  /** Returns the next float in the half-open interval [0, 1). */
  next(): number;
  /** Returns the current internal state (for serialization). */
  getState(): number;
  /** Overwrites the internal state (for deserialization). */
  setState(state: number): void;
}

/**
 * Creates a mulberry32 generator from a numeric seed.
 *
 * The seed is coerced to a 32-bit unsigned integer. Distinct seeds produce
 * distinct, repeatable streams.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      // mulberry32
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState(): number {
      return state;
    },
    setState(next: number): void {
      state = next >>> 0;
    },
  };
}

/** Serializable snapshot of an {@link Rng}'s stream position. */
export interface RngState {
  seed: number;
  state: number;
}

/** Captures the seed and current stream position of a generator. */
export function serializeRng(rng: Rng, seed: number): RngState {
  return { seed, state: rng.getState() };
}

/** Rebuilds a generator resumed at a previously serialized position. */
export function deserializeRng(saved: RngState): Rng {
  const rng = createRng(saved.seed);
  rng.setState(saved.state);
  return rng;
}
