/**
 * TEMPORARY demo wiring (render step only).
 *
 * ⚠️ This is scaffolding for viewing the Three.js render layer via `npm run
 * dev`. It runs the real simulation with a *scripted* throttle so the train
 * drives itself and the world/effects are visible. A later step will replace
 * this with the real React HUD + keyboard controls. Keep this file minimal.
 *
 * What it does:
 *   - Creates a game simulation.
 *   - Ticks it on a fixed timestep, applying a simple scripted throttle that
 *     eases up hills so the train keeps moving and occasionally slips.
 *   - Buys the loco-2 upgrade + accepts some cargo automatically at stations so
 *     the wagon/loco-swap rendering paths are exercised.
 *   - Mounts a {@link WorldView} that reads snapshots each frame.
 */

import { useEffect, useRef } from "react";
import { createGameSimulation } from "./game/Game";
import { WorldView } from "./render/WorldView";

/** Fixed simulation timestep, seconds. */
const SIM_DT = 1 / 60;

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sim = createGameSimulation({ seed: 7 });
    let simAccumulator = 0;
    let lastTime = performance.now();
    let acceptedAtStation = new Set<string>();

    // Scripted "driver": full throttle on the flat, ease off on steep grades to
    // avoid a permanent stall, and dab the brakes when overspeeding downhill.
    function driveScript(): void {
      const s = sim.getSnapshot();
      let throttle = 0.85;
      if (s.grade > 0.05) throttle = 1;
      else if (s.grade < -0.02 && s.speed > 22) throttle = 0.2;
      // Back off if critically hot so the demo doesn't end in engine failure.
      if (s.temperatureState === "critical") throttle = 0.4;
      const brake = s.grade < -0.02 && s.speed > 26 ? 0.5 : 0;
      sim.applyAction({ throttle, brake });

      // At a station: grab the loco upgrade + a cargo job once, to exercise the
      // loco-swap and wagon rendering paths.
      if (s.station.inRange && s.station.stationId) {
        const key = s.station.stationId;
        if (!acceptedAtStation.has(key)) {
          acceptedAtStation.add(key);
          for (const it of s.station.interactions) {
            if (it.kind === "buy-upgrade" && it.id === "upgrade-loco-2") {
              sim.applyAction({ buyUpgradeId: it.id });
            }
            if (it.kind === "pickup-cargo" && it.id) {
              sim.applyAction({ acceptCargoId: it.id });
            }
          }
        }
      }
    }

    // Advance the sim on a fixed step decoupled from the render frame rate.
    let simRaf = 0;
    const stepSim = (): void => {
      simRaf = requestAnimationFrame(stepSim);
      const now = performance.now();
      simAccumulator += Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      while (simAccumulator >= SIM_DT) {
        driveScript();
        sim.tick(SIM_DT);
        simAccumulator -= SIM_DT;
      }
    };
    stepSim();

    const world = new WorldView(() => sim.getSnapshot());
    world.mount(container);

    return () => {
      cancelAnimationFrame(simRaf);
      world.dispose();
      acceptedAtStation = new Set<string>();
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Three.js mounts its canvas here. */}
      <div ref={containerRef} id="game-canvas" className="absolute inset-0" />

      {/* Temporary label so it's obvious this is scaffolding, not the HUD. */}
      <div className="pointer-events-none absolute top-3 left-3 rounded bg-black/40 px-3 py-1 font-mono text-xs tracking-wide text-neutral-200 uppercase">
        Render demo — scripted throttle (temporary)
      </div>
    </div>
  );
}
