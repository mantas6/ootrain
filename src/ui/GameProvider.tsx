/**
 * GameProvider — publishes snapshots to the UI tree and exposes dispatch.
 *
 * The provider holds the latest snapshot in React state. The game loop (for now
 * App.tsx's demo loop) pushes fresh snapshots via the `publish` function handed
 * back through the `onReady` callback. This keeps the provider minimal and lets
 * step 7 own the real loop without changing the UI.
 *
 * To avoid re-rendering the whole tree every animation frame, the loop should
 * call `publish` at a modest cadence (see App.tsx's UI refresh throttle).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { GameSnapshot } from "../game/simulation/types";
import {
  GameContext,
  type GameContextValue,
  type SimHandle,
} from "./GameContextValue";

/** Imperative controls handed to the loop owner. */
export interface GameProviderControls {
  /** Push a fresh snapshot into the UI (triggers a re-render). */
  publish: (snapshot: GameSnapshot) => void;
}

interface GameProviderProps {
  /** The sim handle (read snapshots, dispatch actions). */
  sim: SimHandle;
  /** Called once with imperative controls so the loop can publish snapshots. */
  onReady?: (controls: GameProviderControls) => void;
  children: ReactNode;
}

/** Provides snapshot + dispatch to descendants; loop owner pushes snapshots. */
export function GameProvider({
  sim,
  onReady,
  children,
}: GameProviderProps): ReactNode {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() =>
    sim.getSnapshot(),
  );

  const publish = useCallback((next: GameSnapshot) => {
    setSnapshot(next);
  }, []);

  // Hand imperative controls to the loop owner once.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  useEffect(() => {
    onReadyRef.current?.({ publish });
  }, [publish]);

  const applyAction = useCallback(
    (action: Parameters<SimHandle["applyAction"]>[0]) => {
      sim.applyAction(action);
    },
    [sim],
  );

  const value: GameContextValue = { snapshot, applyAction };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
