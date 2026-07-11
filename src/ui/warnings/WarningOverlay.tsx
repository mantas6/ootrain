/**
 * WarningOverlay — non-blocking alert banners derived from the snapshot.
 *
 * Surfaces the run's pressure signals: temperature warning/critical, active
 * wheel slip, low fuel, fire proximity, and low time. Each warning has a
 * severity that drives colour and (for the most urgent) a pulse. The overlay is
 * purely reactive — it owns no rules, only reads snapshot state.
 */

import type { ReactNode } from "react";
import type { GameSnapshot } from "../../game/simulation/types";

type Severity = "info" | "warning" | "critical";

interface WarningItem {
  key: string;
  label: string;
  severity: Severity;
}

/** Fire proximity (metres) under which the "fire close" warning shows. */
const FIRE_CLOSE_M = 500;
/** Fire proximity (metres) under which it becomes critical. */
const FIRE_CRITICAL_M = 200;
/** Time (seconds) under which the low-time warning shows. */
const LOW_TIME_S = 60;
/** Fuel fraction under which the low-fuel warning shows. */
const LOW_FUEL_FRAC = 0.15;

const SEVERITY_CLASS: Record<Severity, string> = {
  info: "border-sky-600/70 bg-sky-950/80 text-sky-200",
  warning: "border-amber-600/70 bg-amber-950/80 text-amber-200",
  critical: "border-red-600/80 bg-red-950/85 text-red-200 animate-pulse",
};

/** Builds the active warnings list from a snapshot. */
function collectWarnings(s: GameSnapshot): WarningItem[] {
  const out: WarningItem[] = [];

  if (s.temperatureState === "critical" || s.temperatureState === "failure") {
    out.push({
      key: "temp",
      label: "ENGINE CRITICAL — reduce throttle!",
      severity: "critical",
    });
  } else if (s.temperatureState === "warning") {
    out.push({
      key: "temp",
      label: "Engine hot — ease off the throttle",
      severity: "warning",
    });
  }

  if (s.tractionState === "slipping") {
    out.push({
      key: "slip",
      label: "Wheel slip — losing traction",
      severity: "warning",
    });
  }

  const fuelFrac = s.fuelCapacity > 0 ? s.fuelLitres / s.fuelCapacity : 0;
  if (s.fuelLitres <= 0) {
    out.push({ key: "fuel", label: "OUT OF FUEL", severity: "critical" });
  } else if (fuelFrac <= LOW_FUEL_FRAC) {
    out.push({
      key: "fuel",
      label: "Low fuel — refuel soon",
      severity: "warning",
    });
  }

  // Fire proximity + low-time only apply when the fire/timer mechanic is on.
  if (s.fireEnabled) {
    if (s.fireDistanceM <= FIRE_CRITICAL_M) {
      out.push({
        key: "fire",
        label: "FIRE CLOSING IN — move!",
        severity: "critical",
      });
    } else if (s.fireDistanceM <= FIRE_CLOSE_M) {
      out.push({
        key: "fire",
        label: "Fire approaching from behind",
        severity: "warning",
      });
    }

    if (s.timeRemainingS <= LOW_TIME_S) {
      out.push({
        key: "time",
        label: "TIME RUNNING OUT",
        severity: "critical",
      });
    }
  }

  return out;
}

interface WarningOverlayProps {
  snapshot: GameSnapshot;
}

/** Stack of non-blocking warning banners. */
export function WarningOverlay({ snapshot }: WarningOverlayProps): ReactNode {
  if (snapshot.runState !== "running") return null;
  const warnings = collectWarnings(snapshot);
  if (warnings.length === 0) return null;

  return (
    <div className="pointer-events-none flex flex-col items-center gap-1.5">
      {warnings.map((w) => (
        <div
          key={w.key}
          className={[
            "rounded-md border px-4 py-1.5 font-mono text-xs font-bold tracking-wide shadow-lg backdrop-blur-sm",
            SEVERITY_CLASS[w.severity],
          ].join(" ")}
        >
          {w.label}
        </div>
      ))}
    </div>
  );
}
