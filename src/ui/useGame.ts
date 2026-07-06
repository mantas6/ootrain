/**
 * `useGame` hook — the UI's read/dispatch access to the simulation bridge.
 *
 * Kept separate from the provider component so the provider module only exports
 * a component (react-refresh friendly).
 */

import { useContext } from "react";
import { GameContext, type GameContextValue } from "./GameContextValue";

/** Returns the current {@link GameContextValue}; throws if used outside a provider. */
export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (ctx === null) {
    throw new Error("useGame must be used within a <GameProvider>");
  }
  return ctx;
}
