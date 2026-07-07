# Out of Time Train — Design Spec

This folder holds the full game design specification for **Out of Time Train
(OOTRAIN)**. It was previously a single `TODO.md`; it's really a spec, so it now
lives here, split into focused files.

`AGENTS.md` (repo root) is the working guide for agents/developers (tech stack,
lint/format setup, architecture rules, conventions). It must be kept in sync
with this spec — whenever decisions here change, update `AGENTS.md` accordingly.

## Contents

1. [Overview](./01-overview.md) — working title, core concept, session length,
   player goal, design pillars, confirmed corrections.
2. [Gameplay](./02-gameplay.md) — game structure (route, stations), core
   gameplay loop, controls, main stats.
3. [Pressure systems](./03-pressure-systems.md) — timer, overheating /
   temperature, traction / wheel slip, wear / damage.
4. [Cargo & locomotives](./04-cargo-locomotives.md) — cargo jobs and the two
   locomotives.
5. [Camera & UI](./05-camera-ui.md) — camera modes, HUD, world strip, map/menu
   view, fire chase, terrain detail.
6. [Audio & visuals](./06-audiovisual.md) — visual style / tech direction and
   procedural audio design.
7. [Tech & architecture](./07-tech.md) — technology stack, asset/UI/code-org/
   lint directions, programmatic play, testing, suggested source structure.
8. [Open questions](./08-open-questions.md) — unresolved design questions and
   the update policy.

## Update policy

This spec should be updated whenever the design changes or new details are
added. Commit each change individually with a clear, focused message (one
logical change per commit).
