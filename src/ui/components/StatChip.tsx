/**
 * StatChip — a compact labelled value readout (label above, big value below).
 *
 * Used for money, weight, and damage readouts. Presentational only.
 */

import type { ReactNode } from "react";

interface StatChipProps {
  /** Small uppercase label. */
  label: string;
  /** Main value (already formatted). */
  value: string;
  /** Optional trailing unit shown smaller after the value. */
  unit?: string;
  /** Optional Tailwind text-color class for the value (e.g. urgency). */
  valueClassName?: string;
  /** Optional leading icon glyph. */
  icon?: ReactNode;
}

/** A small dark stat readout tile. */
export function StatChip({
  label,
  value,
  unit,
  valueClassName,
  icon,
}: StatChipProps): ReactNode {
  return (
    <div className="rounded-md border border-neutral-700/80 bg-neutral-900/80 px-3 py-1.5 backdrop-blur-sm">
      <div className="font-mono text-[9px] font-semibold tracking-widest text-neutral-400 uppercase">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        {icon}
        <span
          className={[
            "font-mono text-lg leading-tight font-bold tabular-nums",
            valueClassName ?? "text-neutral-100",
          ].join(" ")}
        >
          {value}
        </span>
        {unit !== undefined && (
          <span className="font-mono text-[10px] text-neutral-500">{unit}</span>
        )}
      </div>
    </div>
  );
}
