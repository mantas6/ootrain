# AGENTS.md — Out of Time Train (OOTRAIN)

Working guide for agents/developers. Read `TODO.md` for the full game design;
keep this file in sync with it whenever decisions change.

## Tech stack

- **Vite + TypeScript + React** (npm). `base: './'` so builds work on GitHub Pages.
- **Three.js** for the 3D game view (2.5D side-view). Canvas renders the world only.
- **React + Tailwind CSS v4** (`@tailwindcss/vite`) for HUD/menus as DOM overlays.
- **Web Audio API** for procedural/looped sound.
- **Vitest** for tests. **ESLint 9 flat config** + **typescript-eslint** (type-aware)
  - **Prettier** (formatting only) + react-hooks/react-refresh plugins.
- Persistence via `localStorage`. Assets are procedural Three.js geometry first.

## npm scripts

- `npm run dev` — Vite dev server.
- `npm run build` — `tsc -b && vite build`.
- `npm run preview` — preview the production build.
- `npm run lint` — ESLint over the repo.
- `npm run format` — Prettier write.
- `npm test` — `vitest run` (CI).
- `npm run test:watch` — Vitest watch mode.

## Architecture rules

- **Simulation is decoupled from rendering and UI.** The sim owns all game rules;
  Three.js and React consume snapshots and dispatch `TrainAction`s (see TODO.md
  "Suggested API shape": `createGameSimulation`, `applyAction`, `tick`, `getSnapshot`).
- **Granular files.** No monolithic scene/game files. One object/system per file
  (locomotive, wagon, wheels, track, terrain tile, station, smoke, sparks, fire front).
  Prefer reusable factories/components for procedural Three.js objects.
- Follow the source layout under `src/` (`game/`, `render/`, `ui/`, `audio/`, `input/`).
- **Procedural assets first.** Build train/wagons/stations/terrain from Three.js
  primitives and grouped meshes. Blender/GLB is optional and later only.
- **UI reads snapshots, never owns rules.** HUD/gauges/panels are DOM overlays.

## Testing rules

- Test primarily against the **decoupled simulation core**, not Three.js/DOM.
- Instantiate state, apply actions, advance ticks, assert on snapshots.
- Keep tests **deterministic**: seed randomness, use fixed tick sizes.
- Co-locate `*.test.ts` next to the module, or mirror under `tests/`.
- Priority coverage: physics, temperature, traction/slip, fire front, data
  integrity (route/stations/cargo/locos/upgrades), save/load round-trip.

## Audio reproducibility rule

- If audio assets are generated, **commit the generator script/recipe** alongside
  them. Never leave `.wav`/`.ogg` files without their source.
- Generated audio → `assets/audio/`; generators → `src/audio/generators/`
  or `scripts/audio/`.

## Conventions

- **One logical change per commit**, with a clear, focused message.
- Format new/edited files with Prettier; let ESLint handle correctness only.
- Update `TODO.md` and this file together when design decisions change.
