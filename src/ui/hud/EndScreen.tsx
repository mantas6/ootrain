/**
 * EndScreen — win/fail overlay shown when the run ends.
 *
 * Reads the snapshot's `runState` + `runEndReason` for the outcome, and shows
 * money earned and time used. Restart is handled by the shell (a fresh sim, no
 * page reload). Blocks interaction with the game beneath it.
 */

import type { ReactNode } from "react";
import type { GameSnapshot, RunEndReason } from "../../game/simulation/types";
import { RUN_TIME_LIMIT_S } from "../../game/simulation/constants";
import { formatMoney, formatTime } from "../format";

/** Human-readable outcome text per end reason. */
const REASON_TEXT: Record<RunEndReason, string> = {
  none: "",
  "reached-finish": "You reached the rescue summit ahead of the fire.",
  "time-out": "The clock ran out before you reached the summit.",
  "fire-caught": "The fire caught the train.",
  "engine-failure": "The engine overheated and failed.",
};

interface EndScreenProps {
  snapshot: GameSnapshot;
  /** Start a fresh run (owned by the shell; no page reload). */
  onRestart: () => void;
}

/** Win/fail overlay with outcome, stats, and a restart button. */
export function EndScreen({ snapshot, onRestart }: EndScreenProps): ReactNode {
  if (snapshot.runState === "running") return null;
  const won = snapshot.runState === "won";
  const timeUsed = RUN_TIME_LIMIT_S - snapshot.timeRemainingS;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div
        className={[
          "w-[min(90vw,420px)] rounded-lg border-2 bg-neutral-950/95 p-6 text-center shadow-2xl",
          won ? "border-emerald-600" : "border-red-700",
        ].join(" ")}
      >
        <h1
          className={[
            "font-mono text-3xl font-black tracking-widest uppercase",
            won ? "text-emerald-400" : "text-red-500",
          ].join(" ")}
        >
          {won ? "Rescued" : "Run Failed"}
        </h1>
        <p className="mt-2 font-mono text-xs text-neutral-300">
          {REASON_TEXT[snapshot.runEndReason]}
        </p>

        <div className="my-5 grid grid-cols-2 gap-3">
          <div className="rounded border border-neutral-700 bg-neutral-900 p-3">
            <div className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase">
              Money
            </div>
            <div className="font-mono text-xl font-bold text-amber-300">
              {formatMoney(snapshot.money)}
            </div>
          </div>
          <div className="rounded border border-neutral-700 bg-neutral-900 p-3">
            <div className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase">
              Time Used
            </div>
            <div className="font-mono text-xl font-bold text-neutral-100">
              {formatTime(timeUsed)}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="w-full rounded-md border border-amber-500 bg-amber-500/20 px-4 py-2 font-mono text-sm font-bold tracking-widest text-amber-200 uppercase transition-colors hover:bg-amber-500/30"
        >
          Restart Run
        </button>
      </div>
    </div>
  );
}
