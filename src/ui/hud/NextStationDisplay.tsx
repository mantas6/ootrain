/**
 * NextStationDisplay — always-visible "next station" guidance for the HUD.
 *
 * The snapshot only exposes the *nearest* station (which may be just behind the
 * train), so this readout shows its name, distance and a direction arrow
 * (ahead ► / behind ◄) rather than inventing a new sim field. It gives casual
 * players a constant sense of where the next stop is, complementing the station
 * panel that only appears once stopped in range.
 *
 * Presentational only: reads {@link StationProximity} from the snapshot; owns no
 * game rules.
 */

import type { ReactNode } from "react";
import type { StationProximity } from "../../game/simulation/types";
import { formatDistance } from "../format";

interface NextStationDisplayProps {
  /** Station proximity slice from the current snapshot. */
  station: StationProximity;
}

/** Compact "Next: <name> — <distance> ►/◄" readout. */
export function NextStationDisplay({
  station,
}: NextStationDisplayProps): ReactNode {
  // No station data yet (shouldn't happen once the route loads) — render nothing.
  if (station.stationName === null || !Number.isFinite(station.distanceM)) {
    return null;
  }

  // distanceM is signed: positive = ahead of the train, negative = behind.
  const ahead = station.distanceM >= 0;
  const arrow = ahead ? "►" : "◄";
  const here = station.inRange;

  return (
    <div className="rounded-md border border-neutral-700/80 bg-neutral-900/80 px-3 py-1.5 shadow-lg backdrop-blur-sm">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[9px] font-semibold tracking-widest text-amber-400/90 uppercase">
          Next
        </span>
        <span className="truncate font-mono text-sm font-bold text-neutral-100">
          {station.stationName}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 font-mono text-xs tabular-nums">
        {here ? (
          <span className="font-bold text-emerald-400">
            Arrived — stop here
          </span>
        ) : (
          <>
            <span className="font-bold text-neutral-200">
              {formatDistance(Math.abs(station.distanceM))}
            </span>
            <span className="text-neutral-500">
              {arrow} {ahead ? "ahead" : "behind"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
