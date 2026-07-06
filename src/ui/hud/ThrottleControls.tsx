/**
 * ThrottleControls — on-screen throttle / brake / reverse control surface.
 *
 * The on-screen sliders and the keyboard share a single source of truth: the
 * shell's {@link KeyboardController} control state. This component is fully
 * *controlled* — it renders the current throttle / brake / reverse values and
 * calls back to mutate the same state the keyboard writes. There is no local
 * slider state, so a keyboard notch and a mouse drag never disagree.
 */

import type { ReactNode } from "react";

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
  /** Current throttle value, 0..1 (shared control state). */
  throttle: number;
  /** Current brake value, 0..1 (shared control state). */
  brake: number;
  /** Current reverse state (shared control state). */
  reverse: boolean;
  /** Set the throttle (writes shared control state). */
  onThrottle: (value: number) => void;
  /** Set the brake (writes shared control state). */
  onBrake: (value: number) => void;
  /** Toggle reverse (writes shared control state + dispatches). */
  onReverse: () => void;
}

/** Throttle/brake sliders + reverse toggle backed by shared control state. */
export function ThrottleControls({
  throttle,
  brake,
  reverse,
  onThrottle,
  onBrake,
  onReverse,
}: ThrottleControlsProps): ReactNode {
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
