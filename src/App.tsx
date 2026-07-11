/**
 * App — the thin game shell.
 *
 * App itself only owns the coarse phase machine (start screen vs. an active
 * game session) and the "which sim to start" decision (new run vs. continue a
 * saved run). Each active session is a {@link GameSession} keyed by an
 * incrementing id, so "New Run" / "Restart" simply remounts a fresh session
 * (new sim, loop, world, audio) with no page reload.
 *
 * All the real wiring — the fixed-timestep {@link GameLoop}, keyboard
 * {@link KeyboardController}, {@link WorldView}, {@link AudioEngine}, the HUD
 * and pause/end overlays through the {@link GameProvider} — lives in
 * {@link GameSession}. The scripted auto-driver and manual/auto toggle from the
 * step 4-6 demo are gone; the game is always human-controlled.
 */

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import type { Difficulty, SimState } from "./game/simulation/types";
import { loadGame, clearSave } from "./game/save/localStorageSave";
import { hasResumableSave } from "./game/save/saveIntegration";
import { StartScreen } from "./ui/screens/StartScreen";
import { GameSession } from "./GameSession";

type Phase =
  | { kind: "start" }
  | {
      kind: "playing";
      sessionId: number;
      initialState: SimState | null;
      /** Fire chase + timer active for this fresh run (ignored when resuming). */
      fireEnabled: boolean;
      /** Chosen difficulty for this fresh run (ignored when resuming). */
      difficulty: Difficulty;
    };

export function App(): ReactNode {
  const [phase, setPhase] = useState<Phase>({ kind: "start" });
  // Whether a still-running saved run exists (checked once at mount; a fresh
  // page load is the only route back to this screen).
  const [hasSave] = useState(() => hasResumableSave());

  const startNewRun = useCallback(
    (fireEnabled: boolean, difficulty: Difficulty) => {
      clearSave();
      setPhase((p) => ({
        kind: "playing",
        sessionId: p.kind === "playing" ? p.sessionId + 1 : 1,
        initialState: null,
        fireEnabled,
        difficulty,
      }));
    },
    [],
  );

  const continueRun = useCallback(() => {
    const state = loadGame();
    setPhase((p) => ({
      kind: "playing",
      sessionId: p.kind === "playing" ? p.sessionId + 1 : 1,
      initialState: state,
      // Resuming restores the saved run's own fireEnabled / difficulty via
      // setState; these config values are only fallbacks for fresh-sim setup.
      fireEnabled: state?.fireEnabled ?? true,
      difficulty: state?.difficulty ?? "normal",
    }));
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {phase.kind === "start" ? (
        <StartScreen
          hasSave={hasSave}
          onNewRun={startNewRun}
          onContinue={continueRun}
        />
      ) : (
        <GameSession
          key={phase.sessionId}
          initialState={phase.initialState}
          fireEnabled={phase.fireEnabled}
          difficulty={phase.difficulty}
          onNewRun={startNewRun}
        />
      )}
    </div>
  );
}
