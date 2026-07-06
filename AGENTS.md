# AGENTS.md

Guidance for agents working on **Out of Time Train** (OOTRAIN). See `TODO.md` for the full game plan.

## Project

- Side-view 2.5D train driving/cargo game on **one continuous forward route**. No branching route map.
- Fresh project; being built from the plan in `TODO.md`.

## Tech stack

- **TypeScript** everywhere.
- **Vite** build/dev server.
- **Three.js** for the 3D game view (procedural geometry first; GLTF/GLB optional later).
- **React + Tailwind CSS** for the HUD/UI as a DOM overlay (never drawn inside the canvas).
- **Web Audio API** for sound; save generator scripts for any generated audio (`assets/audio/` output, `scripts/audio/` or `src/audio/generators/` sources).
- **localStorage** for save/progress.
- Static deploy via **GitHub Pages**.

## Lint / format

- **ESLint 9** flat config (`eslint.config.js`) + **typescript-eslint** (type-aware rules).
- **Prettier** owns formatting; ESLint must not fight it (`eslint-config-prettier`).
- **eslint-plugin-react-hooks** + **eslint-plugin-react-refresh** for the React overlay and Vite HMR.
- Run lint and format before committing.

## Architecture rules

- Keep the **simulation core decoupled** from Three.js rendering and React/DOM UI.
- The sim must be headless-testable: instantiate state, `applyAction`, `tick`, `getSnapshot`. Rendering and UI consume snapshots and dispatch actions; game rules never live in the UI or render layer.
- Structure the repo granularly. Avoid large monolithic files; split by system (simulation, render, ui, audio, input, data).
- One graphic/world object per small module (locomotive, wagon, wheels, track, terrain tile, station, smoke, sparks, etc.).
- Prefer reusable factory/components for procedural Three.js objects over one giant scene file.

## Conventions

- Use `trash` instead of `rm` when possible.
- Update `TODO.md` whenever design changes or new details are added.
