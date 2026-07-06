/**
 * TimerDisplay — the big countdown clock.
 *
 * Turns amber under 2 minutes and red + pulsing under 30 seconds so the timer
 * pressure (the run's core threat) is always readable at a glance.
 */

import type { ReactNode } from "react";
import { formatTime } from "../format";

/** Seconds under which the timer reads "warning" (amber). */
const WARN_S = 120;
/** Seconds under which the timer reads "urgent" (red, pulsing). */
const URGENT_S = 30;

interface TimerDisplayProps {
  /** Remaining time, seconds. */
  timeRemainingS: number;
}

/** Large mm:ss countdown that escalates colour as time runs low. */
export function TimerDisplay({ timeRemainingS }: TimerDisplayProps): ReactNode {
  const urgent = timeRemainingS <= URGENT_S;
  const warn = !urgent && timeRemainingS <= WARN_S;

  const color = urgent
    ? "text-red-500"
    : warn
      ? "text-amber-400"
      : "text-neutral-100";

  return (
    <div
      className={[
        "rounded-md border bg-neutral-900/85 px-4 py-1.5 text-center shadow-lg backdrop-blur-sm",
        urgent
          ? "animate-pulse border-red-600/70"
          : warn
            ? "border-amber-600/60"
            : "border-neutral-700/80",
      ].join(" ")}
    >
      <div className="font-mono text-[9px] font-semibold tracking-[0.3em] text-neutral-400 uppercase">
        Time
      </div>
      <div
        className={[
          "font-mono text-4xl leading-none font-black tabular-nums",
          color,
        ].join(" ")}
      >
        {formatTime(timeRemainingS)}
      </div>
    </div>
  );
}
