# Audio & visuals

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
