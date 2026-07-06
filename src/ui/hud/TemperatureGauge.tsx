/**
 * TemperatureGauge — engine temperature with explicit safe/warning/critical
 * zone bands derived from the sim's exported thresholds.
 *
 * The bar's display range runs from ambient to the failure threshold so the
 * warning/critical bands sit at their true relative positions. The fill colour
 * tracks the snapshot's `temperatureState` so the current band is unambiguous.
 */

import type { ReactNode } from "react";
import type { TemperatureState } from "../../game/simulation/types";
import { TEMPERATURE_THRESHOLDS } from "../../game/simulation/temperature";
import { AMBIENT_TEMP_C } from "../../game/simulation/constants";
import { GaugeBar, type GaugeZone } from "../components/GaugeBar";
import { clamp01 } from "../format";

/** Display range: ambient at 0, failure threshold at 1. */
const RANGE_MIN = AMBIENT_TEMP_C;
const RANGE_MAX = TEMPERATURE_THRESHOLDS.failure;

/** Maps a temperature to a 0..1 fraction of the display range. */
function tempToFraction(tempC: number): number {
  return clamp01((tempC - RANGE_MIN) / (RANGE_MAX - RANGE_MIN));
}

const WARNING_FRAC = tempToFraction(TEMPERATURE_THRESHOLDS.warning);
const CRITICAL_FRAC = tempToFraction(TEMPERATURE_THRESHOLDS.critical);

/** Static zone bands (dim) shown behind the fill. */
const ZONES: readonly GaugeZone[] = [
  { from: 0, to: WARNING_FRAC, className: "bg-emerald-900/50" },
  { from: WARNING_FRAC, to: CRITICAL_FRAC, className: "bg-amber-900/50" },
  { from: CRITICAL_FRAC, to: 1, className: "bg-red-900/60" },
];

/** Fill colour per threshold state. */
const FILL: Record<TemperatureState, string> = {
  safe: "bg-emerald-400",
  warning: "bg-amber-400",
  critical: "bg-orange-500",
  failure: "bg-red-600",
};

interface TemperatureGaugeProps {
  /** Engine temperature, °C. */
  temperatureC: number;
  /** Threshold state from the sim. */
  temperatureState: TemperatureState;
}

/** Temperature bar gauge with safe/warning/critical zones. */
export function TemperatureGauge({
  temperatureC,
  temperatureState,
}: TemperatureGaugeProps): ReactNode {
  const fraction = tempToFraction(temperatureC);
  const pulse =
    temperatureState === "critical" || temperatureState === "failure";
  return (
    <GaugeBar
      label="Engine Temp"
      fraction={fraction}
      valueText={`${Math.round(temperatureC)}°C`}
      fillClassName={FILL[temperatureState]}
      zones={ZONES}
      pulse={pulse}
    />
  );
}
