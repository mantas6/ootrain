/**
 * MapScreen — a separate, stylized world overview overlay (not a route planner).
 *
 * Shows the full route as one continuous rail line through labelled regions:
 * burning coast at the start, rescue summit at the finish, an elevation
 * silhouette, station icons along the line, burned shading behind the fire
 * front, and the current train marker. It is illustrative only — the game has a
 * single forward route, so there are no branches or choices here.
 *
 * Toggled by a HUD button; a close button returns to the game.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { GameSnapshot } from "../../game/simulation/types";
import { ROUTE_LENGTH_M } from "../../game/data";
import {
  buildElevationSilhouette,
  buildStripStations,
  silhouetteToPolyline,
} from "../worldStrip";
import { clamp01, positionToStripFraction } from "../format";

const VIEW_W = 1000;
const VIEW_H = 320;
const TOP_PAD = 60;
const BOTTOM_PAD = 70;

interface MapScreenProps {
  snapshot: GameSnapshot;
  onClose: () => void;
}

/** Full-screen stylized island route overview. */
export function MapScreen({ snapshot, onClose }: MapScreenProps): ReactNode {
  const silhouette = useMemo(() => buildElevationSilhouette(), []);
  const stations = useMemo(() => buildStripStations(), []);
  const polyline = useMemo(
    () => silhouetteToPolyline(silhouette, VIEW_W, VIEW_H, TOP_PAD, BOTTOM_PAD),
    [silhouette],
  );
  const polygon = `0,${VIEW_H} ${polyline} ${VIEW_W},${VIEW_H}`;

  const trainX = clamp01(snapshot.progress) * VIEW_W;
  // Fire marker/burned shading only when the fire mechanic is active.
  const fireX = snapshot.fireEnabled
    ? clamp01(positionToStripFraction(snapshot.fireFrontX, ROUTE_LENGTH_M)) *
      VIEW_W
    : -1;

  const stationY = (y: number): number =>
    TOP_PAD + (1 - y) * (VIEW_H - TOP_PAD - BOTTOM_PAD);

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-[min(92vw,1100px)] rounded-lg border border-neutral-700 bg-neutral-950/95 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold tracking-[0.3em] text-amber-400 uppercase">
            Island Escape Route
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-600 bg-neutral-800 px-3 py-1 font-mono text-xs font-bold tracking-widest text-neutral-200 uppercase hover:border-neutral-400"
          >
            Close ✕
          </button>
        </div>

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-[52vh] max-h-[380px] w-full rounded-md"
          role="img"
          aria-label="World route overview"
        >
          <defs>
            <linearGradient id="mapSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="mapLand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3f6212" />
              <stop offset="60%" stopColor="#365314" />
              <stop offset="100%" stopColor="#1c1917" />
            </linearGradient>
            <linearGradient id="mapBurned" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#450a0a" />
              <stop offset="100%" stopColor="#7c2d12" />
            </linearGradient>
          </defs>

          <rect
            x={0}
            y={0}
            width={VIEW_W}
            height={VIEW_H}
            fill="url(#mapSky)"
          />
          <polygon points={polygon} fill="url(#mapLand)" />

          {/* Burned coast / region behind the fire front. */}
          {fireX > 0 && (
            <>
              <rect
                x={0}
                y={0}
                width={fireX}
                height={VIEW_H}
                fill="url(#mapBurned)"
                opacity={0.55}
              />
              <text
                x={Math.min(fireX / 2, VIEW_W - 40)}
                y={28}
                textAnchor="middle"
                className="fill-orange-400 font-mono"
                fontSize={12}
              >
                🔥 BURNED
              </text>
            </>
          )}

          {/* Continuous rail line following the silhouette. */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#a8a29e"
            strokeWidth={2.5}
            strokeDasharray="8 5"
          />

          {/* Region endpoints */}
          <text
            x={8}
            y={VIEW_H - 12}
            className="fill-orange-300 font-mono"
            fontSize={13}
          >
            Cinder Coast (start)
          </text>
          <text
            x={VIEW_W - 8}
            y={TOP_PAD - 20}
            textAnchor="end"
            className="fill-emerald-300 font-mono"
            fontSize={13}
          >
            Rescue Summit (finish)
          </text>

          {/* Stations. */}
          {stations.map((st) => {
            const sx = st.x * VIEW_W;
            const sy = stationY(st.y);
            return (
              <g key={st.id}>
                <rect
                  x={sx - 5}
                  y={sy - 5}
                  width={10}
                  height={10}
                  fill="#fbbf24"
                  stroke="#1c1917"
                  strokeWidth={1}
                />
                <text
                  x={sx}
                  y={sy - 10}
                  textAnchor="middle"
                  className="fill-neutral-300 font-mono"
                  fontSize={9}
                >
                  {st.name}
                </text>
              </g>
            );
          })}

          {/* Fire front. */}
          {fireX >= 0 && fireX <= VIEW_W && (
            <line
              x1={fireX}
              y1={0}
              x2={fireX}
              y2={VIEW_H}
              stroke="#f97316"
              strokeWidth={3}
            />
          )}

          {/* Train marker. */}
          <g>
            <circle
              cx={trainX}
              cy={stationY(sampleY(stations, snapshot.progress))}
              r={8}
              fill="#38bdf8"
              stroke="#082f49"
              strokeWidth={2}
            />
            <text
              x={trainX}
              y={stationY(sampleY(stations, snapshot.progress)) - 14}
              textAnchor="middle"
              className="fill-sky-300 font-mono"
              fontSize={10}
            >
              🚂
            </text>
          </g>
        </svg>

        <p className="mt-3 font-mono text-[10px] tracking-wide text-neutral-500">
          One forward line — climb from the burning coast to the rescue summit
          before the fire and the clock catch you.
        </p>
      </div>
    </div>
  );
}

/** Rough elevation fraction at a progress fraction (for the train marker). */
function sampleY(
  stations: readonly { x: number; y: number }[],
  progress: number,
): number {
  if (stations.length === 0) return 0;
  // Nearest station's elevation is a good-enough visual approximation.
  let best = stations[0];
  let bestDist = Math.abs(stations[0].x - progress);
  for (const st of stations) {
    const d = Math.abs(st.x - progress);
    if (d < bestDist) {
      bestDist = d;
      best = st;
    }
  }
  return best.y;
}
