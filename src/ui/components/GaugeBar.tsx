/**
 * GaugeBar — a labelled horizontal bar gauge with an optional zoned track.
 *
 * The fill fraction (0..1) drives the coloured bar. Optional `zones` draw
 * static coloured bands behind the fill (used by the temperature gauge to show
 * safe/warning/critical regions). Presentational only.
 */

import type { ReactNode } from "react";
import { clamp01, fractionToPercent } from "../format";

/** A static coloured band drawn behind the fill. */
export interface GaugeZone {
  /** Start fraction of the band, 0..1. */
  from: number;
  /** End fraction of the band, 0..1. */
  to: number;
  /** Tailwind background class for the band (dim). */
  className: string;
}

interface GaugeBarProps {
  /** Small uppercase label. */
  label: string;
  /** Fill fraction, 0..1. */
  fraction: number;
  /** Formatted value shown at the right of the label row. */
  valueText: string;
  /** Tailwind bg class for the fill. */
  fillClassName: string;
  /** Optional static zones drawn behind the fill. */
  zones?: readonly GaugeZone[];
  /** Optional pulse animation on the whole gauge (urgent states). */
  pulse?: boolean;
}

/** A horizontal bar gauge with label, value, fill, and optional zone bands. */
export function GaugeBar({
  label,
  fraction,
  valueText,
  fillClassName,
  zones,
  pulse,
}: GaugeBarProps): ReactNode {
  const pct = clamp01(fraction);
  return (
    <div className={pulse === true ? "animate-pulse" : ""}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[9px] font-semibold tracking-widest text-neutral-400 uppercase">
          {label}
        </span>
        <span className="font-mono text-xs font-bold tabular-nums text-neutral-100">
          {valueText}
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
        {zones?.map((zone, i) => (
          <div
            key={i}
            className={["absolute inset-y-0", zone.className].join(" ")}
            style={{
              left: fractionToPercent(zone.from),
              width: fractionToPercent(zone.to - zone.from),
            }}
          />
        ))}
        <div
          className={[
            "absolute inset-y-0 left-0 rounded-full",
            fillClassName,
          ].join(" ")}
          style={{ width: fractionToPercent(pct) }}
        />
      </div>
    </div>
  );
}
