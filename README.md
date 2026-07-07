# Out of Time Train

[![CI](https://github.com/mantas6/ootrain/actions/workflows/ci.yml/badge.svg)](https://github.com/mantas6/ootrain/actions/workflows/ci.yml)

Escape a burning island by rail before the fire and the clock catch you.

**[Play it](https://mantas6.github.io/ootrain/)** — deployed via GitHub Pages.

## Overview

Out of Time Train is a compact 2.5D side-view train driving and cargo game. You
start in a burning lowland on an island and must climb one continuous route to
the rescue summit at the top. A fire front chases you up the line and a
countdown timer runs the whole time — reach the finish before either catches up.

You drive a single locomotive and manage everything that keeps it moving:

- **Throttle, brake, and reverse** to control speed on flats, inclines, and
  steep climbs.
- **Fuel** burned by engine power.
- **Temperature** that rises under heavy throttle, climbing, and heavy loads;
  push past the warning band into critical and the engine can fail.
- **Traction / wheel slip** when you demand too much power for the grade.
- **Damage / wear** that accumulates and degrades performance.
- **Cargo and money** — cargo weight slows you down but pays out on delivery.

Stations sit along the route as tactical stops: pick up and deliver cargo,
repair, refuel, and buy upgrades — including a mid-run locomotive upgrade.
Stopping costs precious time, but skipping a station may cost money, repairs, or
an upgrade you needed.

**Win:** reach the finish before the timer hits zero. **Fail:** run out of time,
overheat the engine past its limit, or let the fire catch the train.

## Controls

Keyboard bindings (from `src/input/controls.ts`):

| Key         | Action                |
| ----------- | --------------------- |
| `W` / `↑`   | Throttle up (notch)   |
| `S` / `↓`   | Throttle down (notch) |
| `Space`     | Brake (hold)          |
| `R`         | Toggle reverse        |
| `E`         | Interact at station   |
| `Tab` / `M` | Toggle map            |
| `P` / `Esc` | Pause                 |
| `N`         | Mute / unmute         |

Use the mouse to inspect the world: drag to orbit/pan the follow camera, and
scroll the wheel to zoom. Throttle, brake, and reverse are also available as
on-screen controls that mirror the keyboard.

## Tech stack

- **Vite + TypeScript + React** with **Tailwind CSS v4** for HUD, gauges, and
  menu overlays.
- **Three.js** for the 3D world, built from procedural geometry (no art assets).
- **Web Audio API** for procedural, generated sound.
- **Vitest** for tests.

The game simulation is fully decoupled from rendering and UI: the sim owns all
rules, while Three.js and React consume snapshots and dispatch actions.

## Development

Prerequisites: **Node 22+** and npm.

```bash
npm install
npm run dev
```

| Script               | Purpose                       |
| -------------------- | ----------------------------- |
| `npm run dev`        | Start the Vite dev server     |
| `npm run build`      | Type-check and build for prod |
| `npm run preview`    | Preview the production build  |
| `npm run lint`       | Run ESLint over the repo      |
| `npm run format`     | Format with Prettier          |
| `npm test`           | Run the test suite once       |
| `npm run test:watch` | Run tests in watch mode       |

## Project structure

```text
src/
  game/     Decoupled simulation core: rules, loop, data, save/load
  render/   Three.js world — camera, scene, train, terrain, effects
  ui/       React + Tailwind overlays: HUD, gauges, map, stations, screens
  audio/    Web Audio procedural sound engine and generators
  input/    Keyboard controls and shared control state
```

## Documentation

- [docs/](./docs/README.md) — full game design spec.
- [AGENTS.md](./AGENTS.md) — contributor / agent working guide.

## Continuous integration

GitHub Actions runs lint, tests, and the production build on every push, and
deploys the built site to GitHub Pages from `main`.
