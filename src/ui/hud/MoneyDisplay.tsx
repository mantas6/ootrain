/**
 * MoneyDisplay — the player's current money (cargo income vs. repair/upgrade
 * spend). Compact readout for the top HUD row.
 */

import type { ReactNode } from "react";
import { StatChip } from "../components/StatChip";
import { formatMoney } from "../format";

interface MoneyDisplayProps {
  /** Player money. */
  money: number;
}

/** Compact money readout. */
export function MoneyDisplay({ money }: MoneyDisplayProps): ReactNode {
  return (
    <StatChip
      label="Money"
      value={formatMoney(money)}
      valueClassName="text-amber-300"
    />
  );
}
