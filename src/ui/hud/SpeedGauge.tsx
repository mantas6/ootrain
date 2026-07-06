/**
 * SpeedGauge — current train speed as a bar gauge (km/h).
 *
 * The bar fills relative to a nominal top speed for readability; the exact
 * numeric value is authoritative. Shows a small "REV" tag when reversing.
 */

import type { ReactNode } from "react";
import { GaugeBar } from "../components/GaugeBar";
import { clamp01, formatSpeedKmh } from "../format";

/** Nominal top speed (km/h) used only to scale the bar fill. */
const NOMINAL_TOP_KMH = 140;

interface SpeedGaugeProps {
  /** Signed speed, m/s. */
  speed: number;
  /** Whether reverse is selected. */
  reverse: boolean;
}

/** Speed bar gauge in km/h. */
export function SpeedGauge({ speed, reverse }: SpeedGaugeProps): ReactNode {
  const kmh = Math.abs(speed) * 3.6;
  const fraction = clamp01(kmh / NOMINAL_TOP_KMH);
  const value = `${formatSpeedKmh(speed)}${reverse ? " REV" : ""} km/h`;
  return (
    <GaugeBar
      label="Speed"
      fraction={fraction}
      valueText={value}
      fillClassName="bg-sky-400"
    />
  );
}
