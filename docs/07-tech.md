# Tech & architecture

## Technology stack

| Area          | Technology                                                      | Why                                                                                           |
| ------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 3D rendering  | **Three.js**                                                    | Stylized 2.5D/inspectable 3D train, terrain, stations, smoke/sparks/heat effects              |
| Language      | **TypeScript**                                                  | Safer game systems and data structures                                                        |
| Build tool    | **Vite**                                                        | Fast local development and simple static web deployment                                       |
| Physics       | **Custom route-based train physics**                            | Better fit than a full physics engine for one rail route                                      |
| UI/HUD        | **React with Tailwind CSS (DOM overlay)**                       | Gauges, station panels, warnings, map/menu screens live outside the canvas for easier styling |
| Audio         | **Web Audio API**                                               | Engine hum, brakes, wheel slip, warning alarms, station ambience                              |
| Assets        | **Procedural Three.js geometry first; GLTF/GLB optional later** | Fast to prototype without Blender; detailed models can be added later if needed               |
| Modeling      | **No Blender required for prototype**                           | Train/wagons/stations can be built from Three.js primitives and custom code first             |
| Data/config   | **TypeScript objects/modules**                                  | Route profile, stations, cargo jobs, locomotive stats, and upgrades stay type-safe in code    |
| Save/progress | **localStorage**                                                | Confirmed save approach for browser prototype                                                 |
| Lint/format   | **ESLint 9 (flat config) + typescript-eslint + Prettier**       | Type-aware linting for the simulation/physics core; Prettier owns formatting                  |
| Testing       | **Vitest**                                                      | Fast, Vite-native unit tests for the decoupled simulation/physics core and data modules       |
| Deployment    | Static web build via **GitHub Pages**                           | Free static hosting; deploy Vite build output through GitHub Actions                          |

Asset direction:

- Start with **procedural Three.js assets**: locomotive, wagons, wheels, couplers, terrain, stations, buildings, smoke/sparks.
- Use grouped meshes and reusable components so assets still look detailed and mechanical.
- Blender is **not required** at the beginning.
- If later we want more polished models, we can export/import GLB assets, but the prototype should not depend on Blender.

UI direction:

- Three.js canvas is responsible for the 3D world only.
- GUI/HUD components should be built with **React** as normal DOM overlays styled with **Tailwind CSS**, not drawn inside the canvas.
- This includes gauges, warnings, cargo/station menus, upgrade/repair panels, pause/menu screens, and map UI overlays.
- React components should read from simulation snapshots and dispatch actions, keeping game rules out of the UI layer.
- This keeps UI fast to build, readable, responsive, and easier to iterate.

Code organization direction:

- Structure the repository as granularly as practical.
- Keep clear separation between systems: simulation, rendering, UI, audio, input, route data, station logic, cargo logic, upgrades, save state, and effects.
- Graphic/world objects should generally live in separate files or small modules: locomotive, wagon, wheels, track, terrain tile, station building, smoke, sparks, vegetation, city props, fire front, etc.
- Avoid large monolithic files. If a file becomes long or mixes unrelated responsibilities, split it into smaller focused files.
- Prefer reusable factory/components for procedural Three.js objects instead of one giant scene file.
- A future agent/developer should be able to find and edit one object/system without reading the whole game.

Lint / format direction:

- **ESLint 9** with the new flat config (`eslint.config.js`).
- **typescript-eslint** for type-aware linting; this is the priority for the simulation/physics core that automated tests rely on (`no-floating-promises`, `strict-boolean-expressions`, exhaustive `switch`, etc.).
- **Prettier** handles formatting only, so ESLint isn't fighting it. Add `eslint-config-prettier` to disable stylistic ESLint rules.
- **eslint-plugin-react-hooks** + **eslint-plugin-react-refresh** for the React DOM/HUD overlay and Vite HMR safety.

## Programmatic play / AI testing direction

- The game should expose a way to play and test it programmatically without using the GUI.
- Core gameplay simulation should be decoupled from Three.js rendering and DOM/Tailwind UI.
- AI agents and automated tests should be able to instantiate the game state, apply actions, advance ticks, and inspect results.
- This makes balancing, regression tests, and AI-driven playtesting possible.

Suggested API shape:

```ts
type TrainAction = {
  throttle?: number; // 0..1
  brake?: number; // 0..1
  reverse?: boolean;
  interact?: boolean;
  acceptCargoId?: string;
  repair?: boolean;
  buyUpgradeId?: string;
  detachCargoId?: string;
};

const sim = createGameSimulation(initialSeedOrConfig);
sim.applyAction({ throttle: 0.7 });
sim.tick(1 / 60);
const snapshot = sim.getSnapshot();
```

The snapshot should expose enough state for automated testing:

- train position / speed
- current grade
- fuel
- temperature
- traction / wheel slip state
- damage
- cargo list
- money
- station proximity and available interactions
- fire-front position
- win/fail state and reason

This means rendering should consume simulation snapshots, not own the game rules.

## Testing direction

- Use **Vitest** as the test runner (Vite-native, TypeScript-first, fast watch mode).
- Write tests primarily against the **decoupled simulation core**, not the Three.js rendering or React/DOM UI.
- Tests should instantiate game state, apply `TrainAction`s, advance ticks, and assert on snapshots.
- Priority coverage areas:
  - Train physics: acceleration, braking, hill grade effects, weight impact.
  - Temperature: heat rise/cooling thresholds and failure states.
  - Traction / wheel slip: slip onset from grade, weight, throttle, and speed.
  - Fire front: advance rate and catch/fail conditions.
  - Data integrity: route, stations, cargo, locomotives, upgrades.
  - Save/load: `localStorage` round-trip.
- Keep tests deterministic: seed randomness and use fixed tick sizes.
- Co-locate tests as `*.test.ts` next to the module under test, or under a `tests/` mirror of `src/`.
- Add an `npm test` script and run tests in CI (GitHub Actions) before build/deploy.

## Suggested source structure

```text
src/
├── main.ts
├── game/
│   ├── Game.ts
│   ├── simulation/
│   │   ├── trainPhysics.ts
│   │   ├── temperature.ts
│   │   ├── traction.ts
│   │   └── fireFront.ts
│   ├── data/
│   │   ├── route.ts
│   │   ├── stations.ts
│   │   ├── locomotives.ts
│   │   ├── cargo.ts
│   │   └── upgrades.ts
│   └── save/
│       └── localStorageSave.ts
├── render/
│   ├── scene.ts
│   ├── camera.ts
│   ├── train/
│   │   ├── Locomotive.ts
│   │   ├── Wagon.ts
│   │   ├── WheelSet.ts
│   │   └── Coupler.ts
│   ├── world/
│   │   ├── Track.ts
│   │   ├── TerrainTile.ts
│   │   ├── StationModel.ts
│   │   ├── Vegetation.ts
│   │   ├── CityProps.ts
│   │   └── FireFrontView.ts
│   └── effects/
│       ├── Smoke.ts
│       ├── Sparks.ts
│       └── HeatShimmer.ts
├── ui/
│   ├── hud/
│   ├── station/
│   ├── map/
│   └── warnings/
├── audio/
│   ├── engineAudio.ts
│   ├── wheelAudio.ts
│   ├── warningAudio.ts
│   └── fireAmbience.ts
└── input/
    └── controls.ts
```
