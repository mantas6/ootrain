/**
 * WeightIndicator — total train mass (loco + cargo) in tonnes, with a cargo
 * wagon count derived from the snapshot's cargo list.
 */

import type { ReactNode } from "react";
import type { ActiveCargo } from "../../game/simulation/types";
import { StatChip } from "../components/StatChip";
import { formatTonnes } from "../format";

interface WeightIndicatorProps {
  /** Total train mass, kilograms. */
  totalMassKg: number;
  /** Coupled cargo jobs (for the wagon count). */
  cargo: readonly ActiveCargo[];
}

/** Compact total-weight readout with wagon count. */
export function WeightIndicator({
  totalMassKg,
  cargo,
}: WeightIndicatorProps): ReactNode {
  const wagons = cargo.reduce((sum, c) => sum + c.wagonCount, 0);
  return (
    <StatChip
      label={`Weight · ${wagons}w`}
      value={formatTonnes(totalMassKg)}
      unit="t"
    />
  );
}
