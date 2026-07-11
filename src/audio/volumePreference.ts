/**
 * Persisted master-volume preference.
 *
 * The chosen volume (0..1) survives reloads via `localStorage`, behind the same
 * injectable-storage pattern the save system uses ({@link VolumeStorage}) so the
 * logic is testable with no DOM. All browser access is guarded (typeof checks +
 * an in-memory fallback), so importing this module under Node/Vitest is safe.
 *
 * The pure {@link parseVolume} does the parse/clamp/fallback and is unit tested;
 * {@link loadVolume} / {@link saveVolume} are thin storage wrappers around it.
 */

/** Minimal storage contract (compatible with `window.localStorage`). */
export interface VolumeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** localStorage key for the persisted master volume. */
export const VOLUME_KEY = "ootrain:volume:v1";

/** Default master volume (0..1) when nothing is stored / the value is invalid. */
export const DEFAULT_VOLUME = 0.8;

/** In-memory storage fallback for non-DOM environments. */
function createMemoryStorage(): VolumeStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

/** Resolves the effective storage: injected, else localStorage, else memory. */
export function resolveVolumeStorage(injected?: VolumeStorage): VolumeStorage {
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

/**
 * Pure parse + clamp of a stored volume string. Returns `fallback` when the
 * raw value is absent or not a finite number; otherwise clamps to 0..1.
 */
export function parseVolume(
  raw: string | null,
  fallback: number = DEFAULT_VOLUME,
): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/** Loads the persisted master volume (0..1), or the default if unset/invalid. */
export function loadVolume(storage?: VolumeStorage): number {
  return parseVolume(resolveVolumeStorage(storage).getItem(VOLUME_KEY));
}

/** Persists the master volume (0..1, clamped) to storage. */
export function saveVolume(volume: number, storage?: VolumeStorage): void {
  const clamped = Math.max(0, Math.min(1, volume));
  resolveVolumeStorage(storage).setItem(VOLUME_KEY, String(clamped));
}
