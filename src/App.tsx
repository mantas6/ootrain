/**
 * App — mounts the Three.js world and the real React HUD over it.
 *
 * The simulation loop here is still the STEP-4 scaffolding: a fixed-timestep
 * loop that (in "auto" mode) drives the train with a scripted throttle so the
 * render layer and effects are visible without input. Step 7 will replace this
 * loop with the real game loop + keyboard input.
 *
 * What is new for step 5:
 *   - A {@link GameProvider} publishes snapshots to the HUD at a modest UI
 *     cadence (so React isn't re-rendering every physics tick).
 *   - The {@link Hud} is mounted over the canvas and is fully interactive.
 *   - A manual/auto toggle (default OFF = auto) decides whether the scripted
 *     driver runs. In manual mode the scripted throttle/brake are suppressed so
 *     the on-screen ThrottleControls (which dispatch through the provider) drive
 *     the train — making the game human-playable with the mouse in `npm run dev`.
 *
 * ⚠️ The scripted-driver bits below are TEMPORARY (step 7 owns the real loop).
 */

import { useEffect, useRef, useState } from "react";
import { createGameSimulation } from "./game/Game";
import { WorldView } from "./render/WorldView";
import { GameProvider, type GameProviderControls } from "./ui/GameProvider";
import type { SimHandle } from "./ui/GameContextValue";
import { Hud } from "./ui/hud/Hud";
import { AudioEngine } from "./audio/audioEngine";

/** Fixed simulation timestep, seconds. */
const SIM_DT = 1 / 60;
/** UI snapshot publish interval, seconds (~20 Hz — plenty for gauges). */
const UI_PUBLISH_DT = 1 / 20;

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  // The single sim instance, created once and shared with the HUD.
  const simRef = useRef(createGameSimulation({ seed: 7 }));
  const sim = simRef.current;

  // The procedural audio layer. Created once; unlocked on first user gesture
  // (browser autoplay policy) and fed snapshots from the loop below.
  const audioRef = useRef<AudioEngine | null>(null);
  audioRef.current ??= new AudioEngine();
  const audio = audioRef.current;

  // Mute state mirrored into React so the HUD button can reflect it.
  const [muted, setMuted] = useState(false);

  // Manual mode gate. A ref mirrors state so the RAF loop reads it without
  // re-subscribing. Default OFF (auto / scripted).
  const [manualMode, setManualMode] = useState(false);
  const manualRef = useRef(manualMode);
  manualRef.current = manualMode;

  // The provider hands back a `publish` fn; the loop calls it on a UI cadence.
  const publishRef = useRef<GameProviderControls["publish"] | null>(null);

  const simHandle: SimHandle = {
    getSnapshot: () => sim.getSnapshot(),
    applyAction: (action) => sim.applyAction(action),
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let simAccumulator = 0;
    let uiAccumulator = 0;
    let audioAccumulator = 0;
    let lastTime = performance.now();
    let acceptedAtStation = new Set<string>();

    // Unlock audio on the first user gesture (required by browser autoplay
    // policy). Once unlocked the handlers detach themselves.
    const unlockAudio = (): void => {
      audio.unlock();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    // ⚠️ TEMPORARY scripted "driver" (step 7 removes this). Only runs in auto
    // mode; in manual mode the on-screen controls own throttle/brake/reverse.
    function driveScript(): void {
      const s = sim.getSnapshot();
      let throttle = 0.85;
      if (s.grade > 0.05) throttle = 1;
      else if (s.grade < -0.02 && s.speed > 22) throttle = 0.2;
      if (s.temperatureState === "critical") throttle = 0.4;
      const brake = s.grade < -0.02 && s.speed > 26 ? 0.5 : 0;
      sim.applyAction({ throttle, brake });

      if (s.station.inRange && s.station.stationId !== null) {
        const key = s.station.stationId;
        if (!acceptedAtStation.has(key)) {
          acceptedAtStation.add(key);
          for (const it of s.station.interactions) {
            if (it.kind === "buy-upgrade" && it.id === "upgrade-loco-2") {
              sim.applyAction({ buyUpgradeId: it.id });
            }
            if (it.kind === "pickup-cargo" && it.id !== undefined) {
              sim.applyAction({ acceptCargoId: it.id });
            }
          }
        }
      }
    }

    let simRaf = 0;
    const stepSim = (): void => {
      simRaf = requestAnimationFrame(stepSim);
      const now = performance.now();
      const elapsed = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      simAccumulator += elapsed;
      uiAccumulator += elapsed;
      audioAccumulator += elapsed;

      while (simAccumulator >= SIM_DT) {
        if (!manualRef.current) {
          driveScript();
        }
        sim.tick(SIM_DT);
        simAccumulator -= SIM_DT;
      }

      // Publish snapshots to the HUD on a modest cadence.
      if (uiAccumulator >= UI_PUBLISH_DT) {
        uiAccumulator = 0;
        publishRef.current?.(sim.getSnapshot());
      }

      // Drive the audio layer on the same modest cadence, passing the elapsed
      // time so continuous sounds ramp smoothly and the brake heuristic works.
      if (audioAccumulator >= UI_PUBLISH_DT) {
        audio.update(sim.getSnapshot(), audioAccumulator);
        audioAccumulator = 0;
      }
    };
    stepSim();

    const world = new WorldView(() => sim.getSnapshot());
    world.mount(container);

    return () => {
      cancelAnimationFrame(simRaf);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      audio.dispose();
      world.dispose();
      acceptedAtStation = new Set<string>();
    };
  }, [sim, audio]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Three.js mounts its canvas here. */}
      <div ref={containerRef} id="game-canvas" className="absolute inset-0" />

      {/* Real HUD overlay, fed by the provider. */}
      <GameProvider
        sim={simHandle}
        onReady={(controls) => {
          publishRef.current = controls.publish;
        }}
      >
        <Hud
          manualMode={manualMode}
          onToggleManual={() => setManualMode((m) => !m)}
          muted={muted}
          onToggleMute={() => setMuted(audio.toggleMuted())}
        />
      </GameProvider>
    </div>
  );
}
