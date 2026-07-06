/**
 * FuelGauge — remaining fuel as a fraction of tank capacity.
 *
 * Turns amber under 25% and red (pulsing) under 10% so the player can plan
 * refuel stops. Fuel exhaustion is not an instant fail, but coasting into the
 * fire is, so the warning still matters.
 */

import type { ReactNode } from "react";
import { GaugeBar } from "../components/GaugeBar";
import { clamp01 } from "../format";

interface FuelGaugeProps {
  /** Remaining fuel, litres. */
  fuelLitres: number;
  /** Tank capacity, litres. */
  fuelCapacity: number;
}

/** Fuel bar gauge (litres remaining / capacity). */
export function FuelGauge({
  fuelLitres,
  fuelCapacity,
}: FuelGaugeProps): ReactNode {
  const fraction = fuelCapacity > 0 ? clamp01(fuelLitres / fuelCapacity) : 0;
  const low = fraction <= 0.25;
  const critical = fraction <= 0.1;
  const fill = critical ? "bg-red-500" : low ? "bg-amber-400" : "bg-yellow-300";
  return (
    <GaugeBar
      label="Fuel"
      fraction={fraction}
      valueText={`${Math.round(fuelLitres)} L`}
      fillClassName={fill}
      pulse={critical}
    />
  );
}
