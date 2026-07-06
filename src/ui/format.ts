/**
 * Pure UI formatting / math helpers.
 *
 * These are deliberately framework-free so they are cheap to unit test and can
 * be reused across HUD, strip, and map components. No game rules live here.
 */

/** Formats seconds as `m:ss` (e.g. 83 -> "1:23"). Clamps negatives to 0. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Formats m/s as an integer km/h string (arcade-friendly). */
export function formatSpeedKmh(metresPerSecond: number): string {
  const kmh = Math.abs(metresPerSecond) * 3.6;
  return Math.round(kmh).toString();
}

/** Formats a mass in kg as tonnes with one decimal (e.g. 90000 -> "90.0"). */
export function formatTonnes(kg: number): string {
  return (kg / 1000).toFixed(1);
}

/** Formats money with a thousands separator and a leading `$`. */
export function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** Clamps a number to the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Clamps a value to 0..1. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Maps a world X position onto a 0..1 strip fraction given the route length.
 * Values outside the route clamp to the ends so markers never overflow.
 */
export function positionToStripFraction(
  positionX: number,
  routeLengthM: number,
): number {
  if (routeLengthM <= 0) return 0;
  return clamp01(positionX / routeLengthM);
}

/** Maps a 0..1 fraction to a percentage string for CSS (e.g. 0.5 -> "50%"). */
export function fractionToPercent(fraction: number): string {
  return `${clamp01(fraction) * 100}%`;
}
