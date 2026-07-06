/**
 * ActionButton — a station-panel action button with an affordable/disabled
 * state. Presentational + click handler only.
 */

import type { ReactNode } from "react";

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Visual tone. */
  tone?: "accept" | "spend" | "danger" | "neutral";
}

const TONE: Record<NonNullable<ActionButtonProps["tone"]>, string> = {
  accept:
    "border-emerald-600 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30",
  spend:
    "border-amber-600 bg-amber-600/20 text-amber-200 hover:bg-amber-600/30",
  danger: "border-red-600 bg-red-600/20 text-red-200 hover:bg-red-600/30",
  neutral:
    "border-neutral-600 bg-neutral-700/40 text-neutral-200 hover:bg-neutral-700/60",
};

/** A compact, tone-coloured action button that disables cleanly. */
export function ActionButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
}: ActionButtonProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled === true}
      className={[
        "rounded border px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide transition-colors",
        disabled === true
          ? "cursor-not-allowed border-neutral-700 bg-neutral-800/60 text-neutral-500"
          : TONE[tone],
      ].join(" ")}
    >
      {label}
    </button>
  );
}
