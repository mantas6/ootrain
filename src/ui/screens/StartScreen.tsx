/**
 * StartScreen — the title / how-to-play screen shown before a run begins.
 *
 * Industrial style consistent with the HUD. Offers "New Run" always, and
 * "Continue" only when a resumable (still-running) save exists. Picking either
 * hands control to the shell which starts the loop.
 */

import { useState, type ReactNode } from "react";
import type { Difficulty } from "../../game/simulation/types";
import { ControlsList } from "./ControlsList";

interface StartScreenProps {
  /** Whether a resumable save exists (shows the Continue button). */
  hasSave: boolean;
  /**
   * Start a fresh run (clears any save). `fireEnabled` carries the relaxed-mode
   * toggle (true = fire chase + timer active), `difficulty` the selected tier.
   */
  onNewRun: (fireEnabled: boolean, difficulty: Difficulty) => void;
  /** Resume the stored run. */
  onContinue: () => void;
}

/** Difficulty tiers offered on the start screen, with a one-line summary. */
const DIFFICULTY_OPTIONS: ReadonlyArray<{
  value: Difficulty;
  label: string;
  blurb: string;
}> = [
  { value: "easy", label: "Easy", blurb: "Relaxed pacing, generous margins" },
  { value: "normal", label: "Normal", blurb: "The intended challenge" },
  { value: "hard", label: "Hard", blurb: "Tight timer, thirsty, unforgiving" },
];

/** Full-screen title + controls + start buttons overlay. */
export function StartScreen({
  hasSave,
  onNewRun,
  onContinue,
}: StartScreenProps): ReactNode {
  // Checkbox is "Disable fire chase" so the default (unchecked) keeps the
  // classic fire-on behaviour. `fireEnabled` is the inverse of the checkbox.
  const [fireDisabled, setFireDisabled] = useState(false);
  // Difficulty selector defaults to the mainstream "normal" tier.
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
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

        <p className="mx-auto mt-2 max-w-sm font-mono text-[11px] leading-relaxed text-amber-300/80">
          Your starter engine can&apos;t make the final climb — haul cargo for
          cash and buy the bigger locomotive at the mid-route repair depot
          before the summit.
        </p>

        <div className="my-5 rounded-md border border-neutral-700/70 bg-neutral-950/60 p-4">
          <h3 className="mb-2 font-mono text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">
            Controls
          </h3>
          <ControlsList />
        </div>

        <div className="mb-4">
          <h3 className="mb-2 font-mono text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">
            Difficulty
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map((opt) => {
              const selected = difficulty === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDifficulty(opt.value)}
                  aria-pressed={selected}
                  className={[
                    "rounded-md border px-2 py-2 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors",
                    selected
                      ? "border-amber-500 bg-amber-500/25 text-amber-200"
                      : "border-neutral-700 bg-neutral-950/60 text-neutral-400 hover:bg-neutral-800/60",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 font-mono text-[10px] text-neutral-500">
            {DIFFICULTY_OPTIONS.find((o) => o.value === difficulty)?.blurb}
          </p>
        </div>

        <label className="mb-4 flex cursor-pointer items-center justify-center gap-2 font-mono text-[11px] tracking-widest text-neutral-300 uppercase select-none">
          <input
            type="checkbox"
            checked={fireDisabled}
            onChange={(e) => setFireDisabled(e.target.checked)}
            className="h-3.5 w-3.5 accent-amber-500"
          />
          Disable fire chase &amp; timer
        </label>

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
            onClick={() => onNewRun(!fireDisabled, difficulty)}
            className="w-full rounded-md border border-amber-500 bg-amber-500/20 px-4 py-2.5 font-mono text-sm font-bold tracking-widest text-amber-200 uppercase transition-colors hover:bg-amber-500/30"
          >
            {hasSave ? "New Run" : "Start Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
