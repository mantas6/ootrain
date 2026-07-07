# Gameplay

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
