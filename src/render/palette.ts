/**
 * Shared industrial / diesel colour palette and a small material + geometry
 * cache for the whole render layer.
 *
 * Every procedural object pulls its colours from here so the world reads as one
 * grimy, mechanical place: cold steel and oil, faded safety orange, ash greys,
 * and the ever-present fire glow behind the train. Keeping the palette in one
 * module means a re-grade is a single-file edit, and sharing cached materials /
 * geometries keeps draw setup cheap (no per-object allocation in hot paths).
 *
 * This module only constructs `THREE.Color`s and (lazily) materials/geometries.
 * `THREE.Color` needs no WebGL context, and materials/geometries are plain CPU
 * objects until uploaded by a renderer, so importing this file is safe in tests
 * and during SSR/build — nothing here touches a GL context.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
} from "three";

/**
 * Named palette entries as hex ints. Grouped by role so a future re-grade is
 * legible. These are deliberate choices for a diesel-era escape story, not
 * generic defaults: oxidised steel blues, faded hazard orange, soot, and a
 * saturated ember set for the fire.
 */
export const PALETTE = {
  // Sky / atmosphere
  skyHigh: 0x2b3a4a, // cold overcast blue-grey up high
  skyLow: 0x6b4a3a, // smoky brown-orange near the horizon (fire haze)
  fog: 0x5a4638, // ash-brown fog tint

  // Ground / terrain
  grassLive: 0x5c6b3a, // dry olive scrub
  grassDim: 0x47502e, // shadowed grass
  soil: 0x574433, // exposed earth
  rock: 0x6d6a63, // grey basalt
  rockDark: 0x4c4a45,
  sand: 0x9a8158,

  // Burned / scorched variants
  ash: 0x2e2a27, // burned ground
  ashLight: 0x453f3a,
  ember: 0xff5a1e, // glowing ember orange (emissive)
  charTree: 0x241f1c, // charred trunk/canopy

  // Vegetation
  foliage: 0x3f5a2f,
  foliageDim: 0x33491f,
  trunk: 0x4a3626,
  bush: 0x415a2c,

  // Structures / city props
  building: 0x8a8378,
  buildingWarm: 0x9c7a55,
  roof: 0x6e4634,
  roofDark: 0x3f2f28,
  shed: 0x726a5c,
  concrete: 0x9b988f,
  woodPlank: 0x7a5a3c,
  metalPole: 0x565049,

  // Track
  rail: 0x8f9299, // bright steel railhead
  railSide: 0x55575c,
  sleeper: 0x4a3b30, // creosote sleeper
  ballast: 0x5f5a52, // track ballast stone

  // Locomotive 1 — diesel-electric (cool industrial blue-green)
  loco1Body: 0x2f5d63,
  loco1Roof: 0x24484d,
  loco1Trim: 0xd98a2b, // faded safety orange stripe
  // Locomotive 2 — diesel-hydraulic (heavier maroon / steel)
  loco2Body: 0x7a3b34,
  loco2Roof: 0x5c2c27,
  loco2Trim: 0xe0b23a, // ochre-yellow trim

  // Shared loco / wagon detail
  chassis: 0x1f2124, // near-black underframe
  metalDark: 0x33363b,
  metalMid: 0x54585e,
  buffer: 0x2a2c30,
  handrail: 0xc9b24a, // dull yellow safety rail
  window: 0x1b2830, // dark glazed cab window
  headlight: 0xfff3c4, // warm headlight (emissive)
  wheel: 0x25272b,
  wheelRim: 0x6a6d72,

  // Cargo
  ore: 0x5b4636,
  coal: 0x1c1b1c,
  crate: 0x8a6438,
  timber: 0x8a6a44,
  tank: 0x687079,
  steel: 0x60656b,

  // Effects
  smokeDark: 0x2a2622,
  smokeLight: 0x8f8579,
  spark: 0xffb347,
  heat: 0xff7a33,
  glowWarm: 0xffcaa0,
} as const;

/** A palette key (for typed lookups). */
export type PaletteKey = keyof typeof PALETTE;

/** Returns a fresh {@link Color} for a palette key (safe to mutate). */
export function color(key: PaletteKey): Color {
  return new Color(PALETTE[key]);
}

/**
 * Options for a cached standard material. Only the fields we actually vary are
 * exposed; everything else uses sensible matte-industrial defaults.
 */
export interface StdMatOptions {
  color: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  flatShading?: boolean;
}

const materialCache = new Map<string, MeshStandardMaterial>();

function matKey(o: StdMatOptions): string {
  return [
    o.color,
    o.roughness ?? 0.9,
    o.metalness ?? 0.1,
    o.emissive ?? 0,
    o.emissiveIntensity ?? 1,
    o.transparent ? 1 : 0,
    o.opacity ?? 1,
    o.flatShading ? 1 : 0,
  ].join(":");
}

/**
 * Returns a shared {@link MeshStandardMaterial} for the given options. Repeated
 * calls with identical options return the *same* instance so many meshes share
 * one GPU program/upload. Never mutate a returned material in place — request a
 * new variant via options instead.
 */
export function stdMaterial(o: StdMatOptions): MeshStandardMaterial {
  const key = matKey(o);
  const existing = materialCache.get(key);
  if (existing) return existing;
  const mat = new MeshStandardMaterial({
    color: o.color,
    roughness: o.roughness ?? 0.9,
    metalness: o.metalness ?? 0.1,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    flatShading: o.flatShading ?? false,
  });
  materialCache.set(key, mat);
  return mat;
}

/** Convenience: cached material straight from a palette key. */
export function paletteMaterial(
  key: PaletteKey,
  extra: Partial<Omit<StdMatOptions, "color">> = {},
): MeshStandardMaterial {
  return stdMaterial({ color: PALETTE[key], ...extra });
}

// --- Shared unit geometries ------------------------------------------------
// Unit-sized primitives reused across many objects via per-mesh scale, so we
// upload a handful of geometries instead of thousands. Objects that need exact
// dimensions still build their own geometry; these cover the common cases.

const geometryCache = new Map<string, BufferGeometry>();

/** A shared 1×1×1 box geometry (scale the mesh to size it). */
export function unitBox(): BoxGeometry {
  const cached = geometryCache.get("unitBox");
  if (cached) return cached as BoxGeometry;
  const geo = new BoxGeometry(1, 1, 1);
  geometryCache.set("unitBox", geo);
  return geo;
}

/** A shared unit cylinder (radius 0.5, height 1, along Y). */
export function unitCylinder(radialSegments = 12): CylinderGeometry {
  const key = `unitCyl:${radialSegments}`;
  const cached = geometryCache.get(key);
  if (cached) return cached as CylinderGeometry;
  const geo = new CylinderGeometry(0.5, 0.5, 1, radialSegments);
  geometryCache.set(key, geo);
  return geo;
}

/**
 * Disposes all cached materials and geometries. Call from a top-level
 * `dispose()` when tearing the whole renderer down (e.g. HMR / unmount) so GPU
 * resources are freed. After calling this, request new caches via the getters.
 */
export function disposeSharedCaches(): void {
  for (const mat of materialCache.values()) (mat as Material).dispose();
  materialCache.clear();
  for (const geo of geometryCache.values()) geo.dispose();
  geometryCache.clear();
}
