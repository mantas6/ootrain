/**
 * Hud — top-level HUD layout composing all overlay pieces.
 *
 * The root container disables pointer events so mouse drags fall through to the
 * Three.js canvas (camera control). Interactive children (controls, station
 * panel, map, buttons) re-enable pointer events on themselves.
 *
 * The game is always human-controlled: throttle / brake / reverse are backed by
 * the shell's shared control state (keyboard + these sliders write the same
 * values). Map open state and pause are lifted to the shell so the M / Tab and
 * P / Esc keys stay in sync with the on-screen buttons.
 *
 * Layout:
 *   - top-left: timer + gauges (speed / rpm / temp / fuel)
 *   - top-right: stat chips (money / weight / damage) + map, pause & mute
 *   - top-center: warning banners
 *   - bottom stack (never overlapping): throttle controls (centered) and the
 *     station panel (right) sit in a row above the full-width progress strip
 *   - overlays: map screen, end screen
 */

import type { ReactNode } from "react";
import { useGame } from "../useGame";
import { TimerDisplay } from "./TimerDisplay";
import { SpeedGauge } from "./SpeedGauge";
import { RpmGauge } from "./RpmGauge";
import { TemperatureGauge } from "./TemperatureGauge";
import { FuelGauge } from "./FuelGauge";
import { WeightIndicator } from "./WeightIndicator";
import { DamageIndicator } from "./DamageIndicator";
import { MoneyDisplay } from "./MoneyDisplay";
import { NextStationDisplay } from "./NextStationDisplay";
import { ThrottleControls } from "./ThrottleControls";
import { ProgressStrip } from "./ProgressStrip";
import { ToastOverlay } from "./ToastOverlay";
import { MuteButton } from "./MuteButton";
import { Panel } from "../components/Panel";
import { WarningOverlay } from "../warnings/WarningOverlay";
import { StationPanel } from "../station/StationPanel";
import { MapScreen } from "../map/MapScreen";

interface HudProps {
  /** Current throttle value, 0..1 (shared control state). */
  throttle: number;
  /** Current brake value, 0..1 (shared control state). */
  brake: number;
  /** Set the throttle (writes shared control state). */
  onThrottle: (value: number) => void;
  /** Set the brake (writes shared control state). */
  onBrake: (value: number) => void;
  /** Toggle reverse (writes shared control state + dispatches). */
  onReverse: () => void;
  /** Whether the map overlay is open (owned by the shell). */
  mapOpen: boolean;
  /** Toggle the map overlay. */
  onToggleMap: () => void;
  /** Pause the run. */
  onPause: () => void;
  /** Whether audio is muted (owned by the audio engine). */
  muted: boolean;
  /** Toggles audio mute. */
  onToggleMute: () => void;
}

/** Composes the full HUD overlay from the current snapshot. */
export function Hud({
  throttle,
  brake,
  onThrottle,
  onBrake,
  onReverse,
  mapOpen,
  onToggleMap,
  onPause,
  muted,
  onToggleMute,
}: HudProps): ReactNode {
  const { snapshot } = useGame();

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Top-left: timer + gauges */}
      <div className="absolute top-3 left-3 flex w-64 flex-col gap-2">
        {/* Timer only matters when the fire chase / countdown is active. */}
        {snapshot.fireEnabled && (
          <TimerDisplay timeRemainingS={snapshot.timeRemainingS} />
        )}
        <Panel>
          <div className="flex flex-col gap-2.5">
            <SpeedGauge speed={snapshot.speed} reverse={snapshot.reverse} />
            <RpmGauge engineRpm={snapshot.engineRpm} />
            <TemperatureGauge
              temperatureC={snapshot.temperatureC}
              temperatureState={snapshot.temperatureState}
            />
            <FuelGauge
              fuelLitres={snapshot.fuelLitres}
              fuelCapacity={snapshot.fuelCapacity}
            />
          </div>
        </Panel>
        {/* Always-visible next-stop guidance (casual-friendly wayfinding). */}
        <NextStationDisplay station={snapshot.station} />
      </div>

      {/* Top-right: stats + buttons */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleMap}
            className={[
              "pointer-events-auto rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest uppercase backdrop-blur-sm",
              mapOpen
                ? "border-amber-500 bg-amber-500/20 text-amber-200"
                : "border-neutral-600 bg-neutral-800/90 text-neutral-200 hover:border-amber-500",
            ].join(" ")}
            title="Toggle world map (M / Tab)"
          >
            Map
          </button>
          <button
            type="button"
            onClick={onPause}
            className="pointer-events-auto rounded-md border border-neutral-600 bg-neutral-800/90 px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest text-neutral-200 uppercase backdrop-blur-sm hover:border-amber-500"
            title="Pause (P / Esc)"
          >
            Pause
          </button>
          <MuteButton muted={muted} onToggle={onToggleMute} />
        </div>
        <div className="flex gap-2">
          <MoneyDisplay money={snapshot.money} />
          <WeightIndicator
            totalMassKg={snapshot.totalMassKg}
            cargo={snapshot.cargo}
          />
          <DamageIndicator
            damage={snapshot.damage}
            wheelDamage={snapshot.wheelDamage}
          />
        </div>
      </div>

      {/* Top-center: warnings */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2">
        <WarningOverlay snapshot={snapshot} />
      </div>

      {/* Top-center (below warnings): transient positive-feedback toasts. */}
      <ToastOverlay />

      {/* Bottom stack: interactive controls always sit above the full-width
          route strip, so the strip (route map) can never overlap the
          throttle/brake levers or the station panel at any viewport size. */}
      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
        {/* Row above the strip: throttle centered, station panel pinned right.
            The station panel is absolutely positioned so it grows upward
            without shifting the centered controls. */}
        <div className="relative flex justify-center">
          <ThrottleControls
            throttle={throttle}
            brake={brake}
            reverse={snapshot.reverse}
            onThrottle={onThrottle}
            onBrake={onBrake}
            onReverse={onReverse}
          />
          {snapshot.station.inRange && (
            <div className="absolute right-0 bottom-0">
              <StationPanel snapshot={snapshot} />
            </div>
          )}
        </div>

        {/* Bottom: progress strip (full width). */}
        <ProgressStrip snapshot={snapshot} />
      </div>

      {/* Map overlay */}
      {mapOpen && <MapScreen snapshot={snapshot} onClose={onToggleMap} />}
    </div>
  );
}
