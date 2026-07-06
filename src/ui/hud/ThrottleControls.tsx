/**
 * ThrottleControls — on-screen throttle / brake / reverse control surface.
 *
 * This is the human control surface until step 7 adds keyboard input. It reads
 * the current reverse state from the snapshot and dispatches {@link TrainAction}
 * for throttle, brake, and reverse. Throttle and brake use range sliders (easy
 * with a mouse); the reverse control is a toggle.
 *
 * The component keeps local slider state and dispatches on every change. It is
 * only active in manual mode (App gates whether it is rendered / whether the
 * scripted driver also runs), so it never fights the demo script.
 */

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useGame } from "../useGame";

/** A vertical labelled slider for throttle / brake. */
function ControlSlider({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent: string;
}): ReactNode {
  return (
    <label className="flex flex-col items-center gap-1">
      <span className="font-mono text-[9px] font-semibold tracking-widest text-neutral-400 uppercase">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className={[
          "h-2 w-32 cursor-pointer appearance-none rounded-full bg-neutral-800 accent-current",
          accent,
        ].join(" ")}
      />
      <span className="font-mono text-xs font-bold tabular-nums text-neutral-100">
        {Math.round(value * 100)}%
      </span>
    </label>
  );
}

interface ThrottleControlsProps {
  /** Current reverse state (from the snapshot). */
  reverse: boolean;
}

/** Throttle/brake sliders + reverse toggle that dispatch TrainActions. */
export function ThrottleControls({
  reverse,
}: ThrottleControlsProps): ReactNode {
  const { applyAction } = useGame();
  const [throttle, setThrottle] = useState(0);
  const [brake, setBrake] = useState(0);

  const onThrottle = useCallback(
    (v: number) => {
      setThrottle(v);
      applyAction({ throttle: v });
    },
    [applyAction],
  );

  const onBrake = useCallback(
    (v: number) => {
      setBrake(v);
      applyAction({ brake: v });
    },
    [applyAction],
  );

  const onReverse = useCallback(() => {
    applyAction({ reverse: !reverse });
  }, [applyAction, reverse]);

  return (
    <div className="pointer-events-auto flex items-end gap-5 rounded-md border border-neutral-700/80 bg-neutral-900/85 px-4 py-3 shadow-lg backdrop-blur-sm">
      <ControlSlider
        label="Throttle"
        value={throttle}
        onChange={onThrottle}
        accent="text-emerald-400"
      />
      <ControlSlider
        label="Brake"
        value={brake}
        onChange={onBrake}
        accent="text-red-400"
      />
      <button
        type="button"
        onClick={onReverse}
        className={[
          "min-w-[64px] rounded-md border px-3 py-2 font-mono text-xs font-bold tracking-widest uppercase transition-colors",
          reverse
            ? "border-amber-500 bg-amber-500/20 text-amber-300"
            : "border-neutral-600 bg-neutral-800 text-neutral-300 hover:border-neutral-500",
        ].join(" ")}
      >
        {reverse ? "Rev ◄" : "Fwd ►"}
      </button>
    </div>
  );
}
