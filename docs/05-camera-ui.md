# Camera & UI

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
