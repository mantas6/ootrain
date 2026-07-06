/**
 * GameSession — one complete run's wiring, mounted fresh per run.
 *
 * Owns (all created once for this session, disposed on unmount):
 *   - the {@link GameSimulation} (optionally seeded from a loaded save),
 *   - the {@link KeyboardController} (shared control state for keyboard + UI),
 *   - the {@link GameLoop} (fixed-step ticking, control application, publishing),
 *   - the {@link WorldView} (Three.js render loop, pulls snapshots itself),
 *   - the {@link AudioEngine} (unlocked on first gesture, fed by the loop),
 *   - autosave to localStorage (periodic + on pause / at stations),
 *   - the React HUD + pause / end overlays via {@link GameProvider}.
 *
 * The loop, controller, world and audio are framework-free and created in a
 * ref/effect; React only holds the small UI-facing state (control values for
 * the sliders, pause flag, map open flag, mute flag) that the shell needs to
 * render overlays and keep keyboard + on-screen buttons in sync.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createGameSimulation } from "./game/Game";
import type { SimState } from "./game/simulation/types";
import { GameLoop } from "./game/GameLoop";
import { KeyboardController, type ControlState } from "./input/controls";
import { WorldView } from "./render/WorldView";
import { AudioEngine } from "./audio/audioEngine";
import { GameProvider, type GameProviderControls } from "./ui/GameProvider";
import type { SimHandle } from "./ui/GameContextValue";
import { Hud } from "./ui/hud/Hud";
import { EndScreen } from "./ui/hud/EndScreen";
import { PauseOverlay } from "./ui/screens/PauseOverlay";
import { saveGame, clearSave } from "./game/save/localStorageSave";
import { AutosaveScheduler } from "./game/save/saveIntegration";

interface GameSessionProps {
  /** Loaded save to resume, or null for a fresh run. */
  initialState: SimState | null;
  /** Start a brand-new run (remounts a fresh session). */
  onNewRun: () => void;
}

export function GameSession({
  initialState,
  onNewRun,
}: GameSessionProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Session singletons (created once for this mounted session) --------
  const simRef = useRef(createGameSimulation({ seed: 7 }));
  const sim = simRef.current;

  const audioRef = useRef<AudioEngine | null>(null);
  audioRef.current ??= new AudioEngine();
  const audio = audioRef.current;

  const controllerRef = useRef<KeyboardController | null>(null);

  // --- UI-facing React state ---------------------------------------------
  const [control, setControl] = useState<{
    throttle: number;
    brake: number;
  }>({ throttle: 0, brake: 0 });
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  // Bumped whenever the sim's runState may have changed, to refresh overlays.
  const [, setEndTick] = useState(0);

  // The loop hands back `publish`; kept in a ref so the effect can call it.
  const publishRef = useRef<GameProviderControls["publish"] | null>(null);
  const loopRef = useRef<GameLoop | null>(null);

  const simHandle: SimHandle = {
    getSnapshot: () => sim.getSnapshot(),
    applyAction: (action) => sim.applyAction(action),
  };

  // Apply a loaded save exactly once, before the loop starts.
  const appliedInitial = useRef(false);
  if (!appliedInitial.current && initialState !== null) {
    sim.setState(initialState);
    appliedInitial.current = true;
  }

  // --- Pause toggle (shared by key + button) -----------------------------
  const togglePause = useCallback(() => {
    const loop = loopRef.current;
    if (!loop) return;
    const nowPaused = loop.togglePause();
    setPaused(nowPaused);
    // Autosave on pause (a natural checkpoint).
    if (nowPaused && sim.getSnapshot().runState === "running") {
      saveGame(sim.getState());
    }
  }, [sim]);

  const resume = useCallback(() => {
    loopRef.current?.resume();
    setPaused(false);
  }, []);

  const toggleMap = useCallback(() => {
    setMapOpen((m) => !m);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(audio.toggleMuted());
  }, [audio]);

  // --- Control surface wiring (keyboard + on-screen sliders) -------------
  const onThrottle = useCallback((v: number) => {
    controllerRef.current?.setThrottle(v);
  }, []);
  const onBrake = useCallback((v: number) => {
    controllerRef.current?.setBrake(v);
  }, []);
  const onReverse = useCallback(() => {
    controllerRef.current?.toggleReverse();
  }, []);

  // Keep the latest callbacks in refs so the mount effect stays stable.
  const togglePauseRef = useRef(togglePause);
  togglePauseRef.current = togglePause;
  const toggleMapRef = useRef(toggleMap);
  toggleMapRef.current = toggleMap;
  const toggleMuteRef = useRef(toggleMute);
  toggleMuteRef.current = toggleMute;

  // --- Mount: build controller, loop, world, audio; run for the session --
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Keyboard controller. Mirror control values into React for the sliders.
    const controller = new KeyboardController({
      onChange: (state: ControlState) => {
        setControl({ throttle: state.throttle, brake: state.brake });
      },
    });
    controller.attach(window);
    controllerRef.current = controller;
    // Reflect the resumed reverse selection into the shared control state so
    // the on-screen Fwd/Rev button matches the loaded run.
    if (initialState !== null && sim.getSnapshot().reverse) {
      controller.toggleReverse();
      controller.consumeEdges();
    }

    // 2. Autosave scheduler.
    const autosave = new AutosaveScheduler();
    let wasInRange = false;

    // 3. The real game loop.
    const loop = new GameLoop({
      sim,
      controls: {
        getState: () => {
          const s = controller.getState();
          return { throttle: s.throttle, brake: s.brake, reverse: s.reverse };
        },
        consumeEdges: () => {
          const e = controller.consumeEdges();
          // Non-gameplay edges are handled here (map / pause / mute) so opening
          // the map or pausing responds even between publish frames.
          if (e.toggleMap) toggleMapRef.current();
          if (e.togglePause) togglePauseRef.current();
          if (e.toggleMute) toggleMuteRef.current();
          return { reverse: e.reverse, interact: e.interact };
        },
      },
      publishUi: (snapshot) => {
        publishRef.current?.(snapshot);
        // Detect run end to swap in the end overlay.
        if (snapshot.runState !== "running") {
          setEndTick((t) => t + 1);
        }
      },
      updateAudio: (snapshot, dt) => {
        audio.update(snapshot, dt);

        // Autosave cadence: periodic + on arriving at a station.
        if (snapshot.runState === "running") {
          const arrivedAtStation = snapshot.station.inRange && !wasInRange;
          if (autosave.tick(dt) || arrivedAtStation) {
            saveGame(sim.getState());
            autosave.markSaved();
          }
          wasInRange = snapshot.station.inRange;
        }
      },
    });
    loopRef.current = loop;

    // 4. The 3D world (owns its own render rAF; pulls snapshots itself).
    const world = new WorldView(() => sim.getSnapshot());
    world.mount(container);

    // 5. Audio unlock on first user gesture (browser autoplay policy).
    const unlockAudio = (): void => {
      audio.unlock();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    // 6. Start the sim loop.
    loop.start();

    return () => {
      loop.stop();
      controller.detach();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      audio.dispose();
      world.dispose();
      controllerRef.current = null;
      loopRef.current = null;
    };
  }, [sim, audio, initialState]);

  // --- Win / fail: clear the save so it isn't offered as "Continue". -----
  const snapshot = sim.getSnapshot();
  const ended = snapshot.runState !== "running";
  useEffect(() => {
    if (ended) {
      clearSave();
      loopRef.current?.pause();
    }
  }, [ended]);

  const restart = useCallback(() => {
    clearSave();
    onNewRun();
  }, [onNewRun]);

  return (
    <>
      {/* Three.js mounts its canvas here. */}
      <div ref={containerRef} id="game-canvas" className="absolute inset-0" />

      <GameProvider
        sim={simHandle}
        onReady={(controls) => {
          publishRef.current = controls.publish;
        }}
      >
        <Hud
          throttle={control.throttle}
          brake={control.brake}
          onThrottle={onThrottle}
          onBrake={onBrake}
          onReverse={onReverse}
          mapOpen={mapOpen}
          onToggleMap={toggleMap}
          onPause={togglePause}
          muted={muted}
          onToggleMute={toggleMute}
        />

        {paused && !ended && (
          <PauseOverlay onResume={resume} onRestart={restart} />
        )}

        {ended && <EndScreen snapshot={snapshot} onRestart={restart} />}
      </GameProvider>
    </>
  );
}
