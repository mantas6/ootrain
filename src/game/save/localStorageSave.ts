/**
 * Save / load of the full simulation state to/from JSON.
 *
 * Storage is injectable via {@link SaveStorage} (a minimal getItem/setItem
 * interface) so tests need no DOM. When no storage is provided the module
 * defaults to `window.localStorage` if available, otherwise an in-memory
 * fallback (keeping the sim usable in non-DOM environments like Node/tests).
 *
 * The serialized payload is the entire {@link SimState}, which round-trips to an
 * identical snapshot because every system reads from that state (including the
 * RNG stream position).
 */

import type { SimState } from "../simulation/types";

/** Minimal storage contract (compatible with `window.localStorage`). */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Default localStorage key for a single save slot. */
export const DEFAULT_SAVE_KEY = "ootrain:save:v1";

/** Versioned save envelope. */
interface SaveEnvelope {
  version: 1;
  state: SimState;
}

/** In-memory storage fallback for non-DOM environments. */
function createMemoryStorage(): SaveStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

/** Resolves the effective storage: injected, else localStorage, else memory. */
export function resolveStorage(injected?: SaveStorage): SaveStorage {
  if (injected) return injected;
  if (
    typeof globalThis !== "undefined" &&
    "localStorage" in globalThis &&
    globalThis.localStorage
  ) {
    return globalThis.localStorage;
  }
  return createMemoryStorage();
}

/** Serializes sim state to a JSON string. */
export function serializeState(state: SimState): string {
  const envelope: SaveEnvelope = { version: 1, state };
  return JSON.stringify(envelope);
}

/** Deserializes a JSON string back into sim state, or null if invalid. */
export function deserializeState(json: string): SimState | null {
  try {
    const parsed = JSON.parse(json) as SaveEnvelope;
    if (parsed && parsed.version === 1 && parsed.state) {
      return parsed.state;
    }
    return null;
  } catch {
    return null;
  }
}

/** Saves sim state to storage under `key`. */
export function saveGame(
  state: SimState,
  storage?: SaveStorage,
  key: string = DEFAULT_SAVE_KEY,
): void {
  resolveStorage(storage).setItem(key, serializeState(state));
}

/** Loads sim state from storage, or null if absent/invalid. */
export function loadGame(
  storage?: SaveStorage,
  key: string = DEFAULT_SAVE_KEY,
): SimState | null {
  const raw = resolveStorage(storage).getItem(key);
  if (raw === null) return null;
  return deserializeState(raw);
}

/** Removes any saved game under `key`. */
export function clearSave(
  storage?: SaveStorage,
  key: string = DEFAULT_SAVE_KEY,
): void {
  resolveStorage(storage).removeItem(key);
}
