/**
 * PauseOverlay — shown while the run is explicitly paused (P / Esc).
 *
 * Note: opening the map or a station panel does NOT pause the game (the fire
 * keeps advancing, per design). Only this overlay stops the sim. Offers resume,
 * restart, and a controls reminder.
 */

import type { ReactNode } from "react";
import { ControlsList } from "./ControlsList";

interface PauseOverlayProps {
  /** Resume the run. */
  onResume: () => void;
  /** Abandon and start a fresh run. */
  onRestart: () => void;
}

/** Full-screen paused overlay with resume / restart + controls reminder. */
export function PauseOverlay({
  onResume,
  onRestart,
}: PauseOverlayProps): ReactNode {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[min(92vw,420px)] rounded-lg border-2 border-neutral-600 bg-neutral-900/95 p-6 text-center shadow-2xl">
        <h1 className="font-mono text-3xl font-black tracking-widest text-neutral-100 uppercase">
          Paused
        </h1>
        <p className="mt-1 font-mono text-[11px] text-neutral-400">
          The fire is waiting. Resume when ready.
        </p>

        <div className="my-5 rounded-md border border-neutral-700/70 bg-neutral-950/60 p-4">
          <h3 className="mb-2 font-mono text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">
            Controls
          </h3>
          <ControlsList />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-md border border-emerald-500 bg-emerald-500/20 px-4 py-2.5 font-mono text-sm font-bold tracking-widest text-emerald-200 uppercase transition-colors hover:bg-emerald-500/30"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-md border border-neutral-600 bg-neutral-800/80 px-4 py-2 font-mono text-xs font-bold tracking-widest text-neutral-300 uppercase transition-colors hover:border-red-500 hover:text-red-300"
          >
            Restart Run
          </button>
        </div>
      </div>
    </div>
  );
}
