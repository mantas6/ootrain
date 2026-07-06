/**
 * DamageIndicator — engine + wheel wear as a combined percentage readout.
 *
 * Shows the worse of the two as the headline value and colours it by severity
 * so heavy damage (which caps power and worsens heat) reads clearly.
 */

import type { ReactNode } from "react";
import { StatChip } from "../components/StatChip";

interface DamageIndicatorProps {
  /** Engine/general damage, 0..1. */
  damage: number;
  /** Wheel/drive damage, 0..1. */
  wheelDamage: number;
}

/** Compact damage readout (worst of engine/wheel). */
export function DamageIndicator({
  damage,
  wheelDamage,
}: DamageIndicatorProps): ReactNode {
  const worst = Math.max(damage, wheelDamage);
  const pct = Math.round(worst * 100);
  const color =
    worst >= 0.6
      ? "text-red-500"
      : worst >= 0.3
        ? "text-amber-400"
        : "text-neutral-100";
  return (
    <StatChip
      label="Damage"
      value={pct.toString()}
      unit="%"
      valueClassName={color}
    />
  );
}
