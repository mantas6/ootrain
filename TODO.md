# Out of Time Train — Game Plan

## Working title

- **Out of Time Train**
- Alternative shorthand: **OOT Train / OOTRAIN**

## Core concept

A compact side-view train driving and cargo game where the player must reach the final destination before the timer reaches zero.

The game is built around **one continuous forward route** from start to finish. There is no branching route map. Stations appear along the same route as optional or required stops.

```text
START ── Station ── Hill ── Station ── Steep climb ── Station ── FINISH
```

## Target session length

- Around **10–15 minutes** per run.

## Player goal

Reach the finish / destination before time runs out while managing:

- Train speed
- Fuel
- Engine temperature
- Cargo weight
- Damage / wear
- Station decisions
- Repairs and upgrades

## Game structure

### Route

- Single side-scrolling X-axis route.
- Train moves generally forward toward the finish.
- Terrain includes:
  - Flat sections
  - Inclines
  - Declines
  - Very steep / extreme sections
- Stations are positioned along this same route.
- No route branching or route planning map.

### Stations

Approximate idea from notes: **7 stations** across the route.

Possible station functions:

- Cargo pickup / delivery
- Repairs
- Upgrades
- Rewards / money opportunities

Stations should feel like tactical decisions: stopping costs time, but skipping may cost money, repairs, or useful upgrades.

## Core gameplay loop

1. Start with a basic locomotive.
2. Drive forward along the route.
3. Manage throttle, brakes, and reverse.
4. Handle hills by balancing power, speed, heat, and fuel.
5. Stop at stations to pick up cargo, deliver cargo, repair, or upgrade.
6. Earn money from cargo jobs.
7. Use money to improve the locomotive or recover from damage.
8. Reach the finish before the timer expires.

## Controls

Initial controls from the sketch:

| Action   | Purpose                                    |
| -------- | ------------------------------------------ |
| Throttle | Increase engine power / acceleration       |
| Brake    | Slow down or stop                          |
| Reverse  | Move backward or help maneuver at stations |

Possible keyboard mapping later:

| Key       | Action                        |
| --------- | ----------------------------- |
| `W` / `↑` | Increase throttle             |
| `S` / `↓` | Decrease throttle / brake     |
| `Space`   | Brake                         |
| `R`       | Toggle reverse                |
| `E`       | Interact with station / cargo |
| `Tab`     | Zoom / UI focus, if needed    |

## Main stats

| Stat          | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| Fuel          | Resource consumed by engine power                                |
| Temperature   | Rises under heavy throttle / climbing; overheating causes damage |
| Speed         | Current train velocity                                           |
| Weight        | Locomotive + cargo mass; affects acceleration and hill climbing  |
| Damage / Wear | General condition of locomotive; repaired at stations            |
| Time          | Countdown to failure; reach finish before zero                   |

## Failure / pressure systems

### Timer

The main pressure is the countdown timer. The player must finish before time reaches zero.

### Overheating / temperature limit

Temperature is a core limiting factor on how much power the player can demand from the engine.

Engine temperature rises from:

- High throttle / sustained engine power
- Climbing uphill
- Pulling heavy cargo / many parts or wagons
- Low speed under heavy load, where the engine works hard but airflow/cooling is poor
- Existing engine damage or poor repair state

Temperature should have clear threshold states:

| State    | Meaning                     | Gameplay result                                                             |
| -------- | --------------------------- | --------------------------------------------------------------------------- |
| Safe     | Normal operating range      | Full control, no penalty                                                    |
| Warning  | Hot but still usable        | UI warning, alarms, player can continue if careful                          |
| Critical | Near maximum                | Power may drop, damage/wear increases quickly, smoke/heat effects intensify |
| Failure  | Exceeds maximum temperature | Engine breaks / run fails unless a recovery mechanic is later added         |

If the player keeps pushing past the warning threshold, the locomotive can reach maximum temperature and effectively fail. The warning state should be readable enough that failure feels like the player's risk decision, not a surprise.

Cooling/recovery options:

- Reduce throttle
- Brake or stop briefly
- Crest the hill and reduce load demand
- Repair/upgrade cooling at stations
- Potential upgrades: better radiator, stronger cooling fan, heat-resistant engine parts

### Traction / wheel slip

Traction is another core limiter on how much cargo the train can haul, especially uphill.

When climbing, the train naturally slows down. If the player demands too much power for the available grip, the wheels can begin to slip instead of transferring power into forward movement.

Wheel slip should be affected by:

- Hill grade / steepness
- Cargo weight and wagon count
- Throttle level / engine torque
- Train speed
- Weather or track condition, if added later
- Locomotive type/upgrades

Gameplay effects:

- Acceleration drops or stops even though the engine is working hard
- Wheels visibly spin faster than the train is moving
- Sparks / screeching / smoke appear near the wheels
- Temperature can rise because power is being wasted
- Wheel/drive damage increases if the player keeps slipping
- Heavy slip can make the train stall on a hill

The player should be able to manage traction by:

- Reducing throttle briefly
- Building speed before a hill
- Choosing lighter cargo
- Upgrading to the stronger locomotive
- Possible future upgrade: sanders / better traction system

### Wear / damage

Damage can come from:

- Overheating
- Wheel slip / traction abuse
- Harsh braking
- Overloading cargo
- Running the engine too hard for too long

Repairs can happen at stations.

## Cargo system

Cargo jobs should show clear tradeoffs.

Cargo pickup UI should include:

- Cargo type / material
- Number of carts
- Weight
- Payment / reward
- Destination station or delivery requirement, if used
- Time or risk impact

Cargo creates interesting choices:

- Heavy cargo pays more but slows the train.
- More carts increase weight and braking distance.
- Some cargo may be better skipped if time is low.

## Locomotives

### Starter locomotive

- Basic locomotive available at the start.
- Lower power.
- Easier fuel use.
- Limited ability on steep hills with heavy cargo.

### Upgradeable locomotive / mid-game locomotive upgrade

The run should include a meaningful **mid-game locomotive upgrade**. The player starts with the weaker locomotive, then later gets access to a stronger one at an upgrade station or major midpoint.

The upgraded locomotive is important because it helps the player handle the later route:

- Pulls more cargo
- Climbs hills more easily
- Has more engine power
- Handles temperature better / does not overheat as quickly
- Makes the second half feel like escalation rather than just more of the same

Tradeoff:

- Uses more fuel
- May cost significant money to buy/install
- Could be heavier or more expensive to repair

The sketch mentions at least two locomotive types:

#### Loco 1 — diesel-electric starter

- Balanced starter / early locomotive.
- Reliable and manageable.
- Lower power.
- More limited on steep climbs and heavy cargo.
- Better fuel economy than the upgraded locomotive.

#### Loco 2 — diesel-hydraulic upgrade

- More powerful mid-game upgrade.
- Pulls heavier cargo.
- Climbs uphill more easily.
- Overheats less under the same load compared to the starter locomotive.
- Uses more fuel.
- Higher operating cost / risk.

## Camera

The main gameplay camera follows the train, but the player should be able to inspect the train freely.

- Default camera is a side-follow view for clear driving.
- Player can **pan/orbit around the train** to see it from different sides.
- Player can **zoom in and out**.
- Zoomed-out view helps see terrain, hills, train length, and upcoming station context.
- Zoomed-in view helps inspect the locomotive, carts, cargo, wheels, heat/smoke effects, and station interaction.
- Camera controls should not turn the game into full 3D steering; train movement is still along the single forward route.

Suggested camera modes:

| Mode          | Purpose                                          |
| ------------- | ------------------------------------------------ |
| Side follow   | Default driving view                             |
| Orbit inspect | Rotate around train to view from all sides       |
| Zoom close    | Inspect loco/cargo/station details               |
| Zoom far      | Read hills, train length, and upcoming obstacles |

## UI / HUD

### Main HUD

Should show:

- Countdown timer
- Speed gauge
- Temperature gauge
- Fuel level
- Weight / cargo load
- Damage / wear
- Money
- Current station prompt, when stopped nearby

### In-game linear progress / world strip

During driving, the player should have a readable progress/world strip. It should still represent **one forward route**, but it does not need to be a plain abstract line.

Instead of a branching route map, make it an **illustrative miniature of the world**:

```text
START ━ small town ━ cargo yard ━ steep mountain ━ repair depot ━ desert bridge ━ FINISH
          ● train position
```

This shows:

- Start and finish
- Train position
- Upcoming stations
- Major hills / danger zones
- Simple terrain landmarks, buildings, bridges, tunnels, mountains, factories, etc.

The key rule: it can look like a world map / diorama, but it should not imply route choices or branching paths unless that design changes later.

### Separate map/menu model

There should also be a separate menu/map screen or 3D model view that displays the world more illustratively than the compact driving HUD.

The current story direction: the train starts in a burning lowland/coastal area on an island and must **climb toward the top of the island / rescue summit** to be saved from the fire. The route should include both downhill and uphill sections, but overall it tells an upward escape story.

Purpose:

- Show the full route as a stylized world overview.
- Make the world feel bigger and more physical.
- Preview upcoming regions/stations/hills.
- Explain the timer through story pressure: fire is spreading behind the player.
- Help the player understand progress without turning it into a route-planning game.

Possible presentation:

- A 3D tabletop-style island diorama of the entire route.
- A scrollable/pannable world overview.
- A stylized parchment/industrial map with terrain landmarks.
- Stations represented as small 3D buildings or icons.
- Route shown as one continuous rail line through the world.
- Lowlands/coast on fire near the start.
- Mountain/rescue/radio tower at the finish.
- Intermediate stations as story beats: cargo yard, ash tunnel, repair depot, mountain bridge, final climb.
- The island should feel like a **living world**, not just mountains: towns/cities, farms, ports, factories, mines, bridges, tunnels, forests, roads, small settlements, industrial districts, and rescue infrastructure.
- The track should be clearly visible as it passes **through different cities and settlements**, not hidden under decorative noise.
- The map should be detailed but readable: each region/city should be distinct, labeled, and connected by the single rail route.
- Scenery should communicate both story and gameplay: burning coast, populated areas under threat, work sites needing supplies, dangerous bridges, mountain communities, and the final rescue zone.
- Avoid a messy collage. Prefer a clean illustrative route-diorama where the player can immediately understand: where the train starts, which cities it crosses, what hazards are ahead, and where rescue is.

### Station UI panels

Potential panels:

- Cargo pickup choice
- Train stats
- Repair panel
- Locomotive upgrade panel

### Fire chase / destroyed world behind the train

The fire should be visible as an advancing threat, not just a background story detail. The player should feel dread because the world behind them is being destroyed and they are barely escaping it.

Fire presentation:

- Fire visibly burns through the world behind the train.
- Smoke columns, ash clouds, embers, orange glow, and burned terrain show where the fire has passed.
- Buildings/vegetation behind the train can appear scorched, collapsed, or burning.
- The fire line should slowly advance forward, creating the feeling that it is chasing the train.
- The map/menu view should also show burned regions behind the current train position.

Gameplay purpose:

- Explains the countdown timer and urgency.
- Makes stopping too long feel dangerous.
- Adds emotional pressure: the route behind you is gone or ruined.
- Reinforces the goal of climbing to rescue before the island is consumed.

Implementation direction:

- Use a moving fire-front position along the route.
- Regions behind the fire-front switch to burned/scorched visual variants.
- If the fire catches the train or reaches a key threshold, the run can fail.
- Fire effects should be readable but not obscure the track or controls.

### Terrain / world tile detail

The playable terrain and map/world tiles should not feel empty or purely functional. Even though the gameplay route is linear, the world around the track should feel alive.

Terrain/world tiles should include:

- Vegetation: grass patches, bushes, trees, burned trees, mountain shrubs
- Random small buildings: houses, sheds, barns, workshops, storage huts, signal boxes
- Industrial details: pipes, tanks, cranes, crates, fences, power poles, rail signs
- City/settlement detail: roads, street lights, rooftops, smoke stacks, small vehicles, evac tents
- Natural landmarks: rocks, cliffs, rivers, bridges, tunnels, ravines, beaches, snow/ash patches
- Fire/story details: smoke columns, embers, burned ground, emergency lights, rescue markers

Tile/design rule:

- The route/track must stay readable and not be hidden by decoration.
- Details should be placed around the track to make the world feel lived-in.
- Decoration should support the region identity: port, lower city, farms, cargo city, tunnel, bridge town, mountain village, summit.
- Use procedural variation so repeated terrain pieces do not look copy-pasted.

## Visual style / tech direction

Current direction:

- **3D using Three.js only** for the game view.
- Best fit is **2.5D side-view 3D**: 3D train, carts, terrain, stations, lighting, smoke, and effects, but gameplay remains on one forward route.
- Camera stays mostly side-on and follows the train.
- Clear silhouettes for locomotive and carts.
- Locomotive and wagons should be **fairly detailed**, not simple boxes: visible wheels, axles, couplers, vents, tanks, panels, ladders, cargo shapes, and weathering.
- Train should feel **mechanical and animated**: wheels turning, rods/axles moving, smoke/exhaust puffs, heat shimmer, sparks under stress, brake dust, suspension bounce, and cargo/wagon sway.
- Big readable gauges and UI overlay.
- Strong hill shapes so route difficulty is visible.
- Industrial / diesel color palette.

## Audio / sound design

Audio should be part of the game feel, not an afterthought. The train should sound heavy, mechanical, and under stress.

Core sound categories:

- Engine idle / engine load loop
- Throttle-up and throttle-down changes
- Wheel rotation / rail clatter that changes with speed
- Brake squeal and brake release
- Wheel slip screech / sparks sound
- Smoke/exhaust puffs
- Overheating warning alarm
- Critical temperature alarm
- Mechanical damage / breaking sounds
- Coupler and wagon clunking
- Cargo loading/unloading sounds
- Station arrival/interact sounds
- Repair/upgrade success sounds
- Money/reward success feedback
- Failure/game-over sound
- Fire ambience: crackling, distant collapses, wind, ash
- UI sounds: button hover/click, warning pings, confirmation/error

Audio implementation direction:

- Use **Web Audio API** for procedural/looped sounds where possible.
- Use short generated or bundled samples for impacts, alarms, clunks, and UI feedback if needed.
- Engine sound should react to throttle, load, grade, and damage.
- Rail/wheel sounds should react to speed.
- Wheel slip and overheating sounds should clearly warn the player before failure.
- Fire ambience should grow stronger when the fire is close behind.

Audio asset reproducibility rule:

- If any audio assets are generated during development, the source code used to create them must be saved in the project.
- Do not leave generated `.wav`, `.ogg`, or other audio files without their generator script or source recipe.
- This is critical so a future agent/developer can regenerate, tweak, or audit the sounds.
- Suggested folder structure: generated audio goes in `assets/audio/`, generator scripts go in `scripts/audio/` or `src/audio/generators/`.

## Design pillars

1. **Always moving toward the finish**
   The player should feel constant forward pressure.

2. **Simple controls, deep management**
   Throttle, brake, reverse are easy to understand, but stats create tension.

3. **Cargo is temptation**
   More cargo means more money, but more weight and risk.

4. **Hills are the main enemy**
   Inclines turn weight, speed, temperature, and fuel into meaningful decisions.

5. **Short complete runs**
   The game should be playable in 10–15 minutes.

## Open questions

- Should cargo be delivered to specific later stations, or simply carried to the finish?
- Should stations be optional, mandatory, or mixed?
- Should the player be allowed to detach cargo to reduce weight?
- Should reverse be mostly for station positioning, or useful during hill failures?
- Should upgrades persist between runs, or reset every run?
- Should the game be roguelite-style, score-attack, or handcrafted level-based?

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

Programmatic play / AI testing direction:

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

Suggested source structure:

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

## Current confirmed corrections

- The game has **one route straight forward to the destination / finish**.
- There is **no route map** and no branching path selection.
- Any map-like UI should be a **linear progress strip**, not a route planner.

## Update policy

This file should be updated whenever the design changes or new details are added.

`AGENTS.md` is the working guide for agents/developers (tech stack, lint/format setup, architecture rules, conventions). It must be kept in sync with this plan — whenever decisions here change, update `AGENTS.md` accordingly.
