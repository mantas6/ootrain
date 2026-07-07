/**
 * RpmGauge — engine crankshaft speed (RPM) as a bar gauge.
 *
 * The bar's display range runs from idle RPM (0) to max RPM (1) using the sim's
 * exported constants, so the fill tracks the true engine spool. A dim redline
 * band sits at the top of the range and the fill turns red once RPM enters it,
 * mirroring the zoned styling of the temperature gauge.
 */

import type { ReactNode } from "react";
import {
  ENGINE_IDLE_RPM,
  ENGINE_MAX_RPM,
} from "../../game/simulation/constants";
import { GaugeBar, type GaugeZone } from "../components/GaugeBar";
import { clamp01 } from "../format";

/** Display range: idle RPM at 0, max RPM at 1. */
const RANGE_MIN = ENGINE_IDLE_RPM;
const RANGE_MAX = ENGINE_MAX_RPM;

/** Fraction of the range where the redline band begins. */
const REDLINE_FRAC = 0.85;

/** Maps an RPM value to a 0..1 fraction of the display range. */
function rpmToFraction(rpm: number): number {
  return clamp01((rpm - RANGE_MIN) / (RANGE_MAX - RANGE_MIN));
}

/** Static redline band (dim) shown behind the fill. */
const ZONES: readonly GaugeZone[] = [
  { from: REDLINE_FRAC, to: 1, className: "bg-red-900/60" },
];

interface RpmGaugeProps {
  /** Engine crankshaft speed, revolutions per minute (RPM). */
  engineRpm: number;
}

/** Engine RPM bar gauge with a redline zone. */
export function RpmGauge({ engineRpm }: RpmGaugeProps): ReactNode {
  const fraction = rpmToFraction(engineRpm);
  const redline = fraction >= REDLINE_FRAC;
  return (
    <GaugeBar
      label="Engine RPM"
      fraction={fraction}
      valueText={`${Math.round(engineRpm)} rpm`}
      fillClassName={redline ? "bg-red-500" : "bg-lime-400"}
      zones={ZONES}
      pulse={redline}
    />
  );
}
