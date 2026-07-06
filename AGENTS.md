# AGENTS.md — Out of Time Train (OOTRAIN)

Working guide for agents/developers. Read `TODO.md` for the full game design;
keep this file in sync with it whenever decisions change.

## Tech stack

- **Vite 8 + TypeScript 6 (strict) + React 19** (npm). `base: './'` so builds
  work on GitHub Pages.
- **Three.js** for the 3D game view (2.5D side-view). Canvas renders the world only.
- **React + Tailwind CSS v4** (`@tailwindcss/vite`) for HUD/menus as DOM overlays.
- **Web Audio API** for fully procedural sound — no audio files in the repo.
- **Vitest 4** (config inside `vite.config.ts`, `environment: "node"` — no DOM tests).
- **ESLint 10 flat config** (`eslint.config.js`) + **typescript-eslint** (type-aware
  via `projectService` for `src`). **Prettier** owns formatting only.
  Note: `eslint-plugin-react-hooks` is registered manually as a plugin object
  because its shipped flat configs use the legacy format ESLint 10 rejects.
- Persistence via `localStorage` behind an injectable storage interface.

## npm scripts

- `npm run dev` — Vite dev server.
- `npm run build` — `tsc -b && vite build`.
- `npm run preview` — preview the production build.
- `npm run lint` — ESLint over the repo.
- `npm run format` — Prettier write.
- `npm test` — `vitest run` (CI).
- `npm run test:watch` — Vitest watch mode.

CI (`.github/workflows/ci.yml`) runs lint, test, and build on every push/PR and
deploys `dist/` to GitHub Pages from `main`.

## Architecture rules

- **Simulation is decoupled from rendering, UI, and audio.** The sim owns all
  game rules; consumers read `GameSnapshot` and dispatch `TrainAction`s
  (`createGameSimulation` → `applyAction` / `tick` / `getSnapshot` in
  `src/game/Game.ts`).
- **Granular files.** One object/system per file (locomotive, wagon, wheels,
  track, terrain tile, station, smoke, sparks, fire front). Reusable factories
  for procedural Three.js objects; shared material/geometry caches in
  `src/render/palette.ts`.
- Source layout: `src/game/` (sim, data, save, loop), `src/render/`, `src/ui/`,
  `src/audio/`, `src/input/`.
- **Balance constants live in `src/game/simulation/constants.ts`** — tune there,
  not inline.
- **Determinism:** all sim randomness goes through the seeded PRNG
  (`src/game/simulation/rng.ts`, mulberry32); its stream position is serialized
  in saves. Render-side scatter uses its own seeded PRNG per tile.
- **Coordinates:** route X = world X, elevation = world Y, track at Z = 0.
- **The game loop is framework-free** (`src/game/GameLoop.ts`): 60 Hz
  fixed-timestep accumulator, ~20 Hz snapshot publish to UI, per-frame updates
  to render/audio. React (`GameSession.tsx`) only wires things together.
- **UI reads snapshots, never owns rules.** Reading static config from
  `src/game/data/` keyed by ids from the snapshot is fine; reaching into sim
  internals is not.
- **Snapshot is the only sim→consumer channel.** If a consumer needs a signal
  the snapshot lacks (e.g. audio needed engine load and used a
  temperature/grade/speed proxy), prefer extending `GameSnapshot` over
  inventing proxies — clean up existing proxies when you do.
- **Guard browser APIs.** Only `WorldView.mount()` may touch WebGL; guard
  `document`/`window`/`AudioContext` usage (`typeof` checks, lazy init on user
  gesture for audio) so every module imports safely under Node/Vitest.

## Testing rules

- Test primarily against the **decoupled simulation core**, not Three.js/DOM.
  No WebGL, DOM-component, or AudioContext tests.
- Instantiate state, apply actions, advance ticks, assert on snapshots.
- Keep tests **deterministic**: seed randomness, use fixed tick sizes.
- **Extract pure functions from impure layers** so they stay testable: input
  reducers, snapshot-transition detection, chunk/strip math, format helpers —
  then unit test those cheaply.
- Co-locate `*.test.ts` next to the module.
- Priority coverage: physics, temperature, traction/slip, fire front, fuel,
  wear, data integrity (route/stations/cargo/locos/upgrades), game loop
  stepping, save/load round-trip.

## Audio rules

- Sound is **fully procedural Web Audio** (oscillators, noise buffers, filters,
  envelopes). No `.wav`/`.ogg` files. If pre-generated assets are ever added,
  commit the generator script alongside them (`assets/audio/` +
  `scripts/audio/`).
- No clicks: ramp parameters (`setTargetAtTime`); long-lived nodes with
  automation, one-shot nodes only for discrete events; everything routed
  through the master gain and disconnected on dispose.

## Conventions

- **One logical change per commit**, with a clear, focused message.
- **Verify before committing:** `npm run lint && npm test && npm run build`
  must all pass; run Prettier on new/edited files.
- **Check the actual repo state before asserting anything** (files, snapshot
  fields, exports). Don't rely on memory of what "should" exist — a prior
  agent claimed `.github/workflows/ci.yml` was missing when it existed.
- SI units everywhere in sim/data; comment the unit on every stat field.
- Update `TODO.md` and this file together when design decisions change.
