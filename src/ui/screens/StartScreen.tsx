/**
 * StartScreen — the title / how-to-play screen shown before a run begins.
 *
 * Industrial style consistent with the HUD. Offers "New Run" always, and
 * "Continue" only when a resumable (still-running) save exists. Picking either
 * hands control to the shell which starts the loop.
 */

import type { ReactNode } from "react";
import { ControlsList } from "./ControlsList";

interface StartScreenProps {
  /** Whether a resumable save exists (shows the Continue button). */
  hasSave: boolean;
  /** Start a fresh run (clears any save). */
  onNewRun: () => void;
  /** Resume the stored run. */
  onContinue: () => void;
}

/** Full-screen title + controls + start buttons overlay. */
export function StartScreen({
  hasSave,
  onNewRun,
  onContinue,
}: StartScreenProps): ReactNode {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-neutral-950/95 backdrop-blur-sm">
      <div className="w-[min(92vw,480px)] rounded-lg border-2 border-amber-700/70 bg-neutral-900/95 p-7 text-center shadow-2xl">
        <h1 className="font-mono text-4xl font-black tracking-[0.15em] text-amber-400 uppercase">
          Out of Time
        </h1>
        <h2 className="mt-1 font-mono text-lg font-bold tracking-[0.3em] text-neutral-300 uppercase">
          Train
        </h2>

        <p className="mx-auto mt-4 max-w-sm font-mono text-[11px] leading-relaxed text-neutral-400">
          The island is burning. Drive your locomotive up the mountain route to
          the rescue summit before the fire and the clock catch you. Manage
          throttle, heat, fuel, traction, and cargo along the way.
        </p>

        <div className="my-5 rounded-md border border-neutral-700/70 bg-neutral-950/60 p-4">
          <h3 className="mb-2 font-mono text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">
            Controls
          </h3>
          <ControlsList />
        </div>

        <div className="flex flex-col gap-2">
          {hasSave && (
            <button
              type="button"
              onClick={onContinue}
              className="w-full rounded-md border border-emerald-500 bg-emerald-500/20 px-4 py-2.5 font-mono text-sm font-bold tracking-widest text-emerald-200 uppercase transition-colors hover:bg-emerald-500/30"
            >
              Continue Run
            </button>
          )}
          <button
            type="button"
            onClick={onNewRun}
            className="w-full rounded-md border border-amber-500 bg-amber-500/20 px-4 py-2.5 font-mono text-sm font-bold tracking-widest text-amber-200 uppercase transition-colors hover:bg-amber-500/30"
          >
            {hasSave ? "New Run" : "Start Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
