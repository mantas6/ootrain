/**
 * The React context object and its value shape for the UI bridge.
 *
 * Kept in a non-component module so the provider component file can satisfy the
 * react-refresh "only export components" rule. The UI never owns game rules: it
 * reads {@link GameSnapshot}s and dispatches {@link TrainAction}s through this
 * thin handle. Step 7 will own the real game loop; for now App.tsx pushes
 * snapshots into the provider.
 */

import { createContext } from "react";
import type { GameSnapshot, TrainAction } from "../game/simulation/types";

/** The sim handle the UI is allowed to touch (read snapshots, dispatch actions). */
export interface SimHandle {
  /** Returns the latest snapshot on demand. */
  getSnapshot: () => GameSnapshot;
  /** Dispatches a player action to the simulation. */
  applyAction: (action: TrainAction) => void;
}

/** Value exposed to consumers via {@link useGame}. */
export interface GameContextValue {
  /** Most recently published snapshot (refreshed by the game loop). */
  snapshot: GameSnapshot;
  /** Dispatch a player action. */
  applyAction: (action: TrainAction) => void;
}

/** The context. `null` until a provider mounts. */
export const GameContext = createContext<GameContextValue | null>(null);
