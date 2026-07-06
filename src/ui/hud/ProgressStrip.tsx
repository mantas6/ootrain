/**
 * ProgressStrip — the illustrative linear world strip.
 *
 * Renders one forward route (no branching) as an SVG: a start→finish baseline,
 * an elevation silhouette derived from the route data (so hills are visible),
 * station markers with tiny labels, the train position marker, and the fire
 * front with burned-region shading behind it. Positions are read from the
 * snapshot; the static geometry comes from the shared route/station data.
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

/** SVG viewBox dimensions (unitless; scaled by CSS). */
const VIEW_W = 1000;
const VIEW_H = 90;
const TOP_PAD = 10;
const BOTTOM_PAD = 26;

interface ProgressStripProps {
  snapshot: GameSnapshot;
}

/** Linear world strip with hills, stations, train, and fire front. */
export function ProgressStrip({ snapshot }: ProgressStripProps): ReactNode {
  const silhouette = useMemo(() => buildElevationSilhouette(), []);
  const stations = useMemo(() => buildStripStations(), []);

  const polyline = useMemo(
    () => silhouetteToPolyline(silhouette, VIEW_W, VIEW_H, TOP_PAD, BOTTOM_PAD),
    [silhouette],
  );
  // Close the polyline into a filled silhouette polygon.
  const polygon = `0,${VIEW_H} ${polyline} ${VIEW_W},${VIEW_H}`;

  const trainFrac = clamp01(snapshot.progress);
  const trainX = trainFrac * VIEW_W;
  const fireFrac = positionToStripFraction(snapshot.fireFrontX, ROUTE_LENGTH_M);
  const fireX = clamp01(fireFrac) * VIEW_W;

  return (
    <div className="pointer-events-none rounded-md border border-neutral-700/80 bg-neutral-900/85 px-3 py-2 shadow-lg backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[9px] font-semibold tracking-widest text-amber-400/90 uppercase">
          Coast
        </span>
        <span className="font-mono text-[9px] font-semibold tracking-widest text-neutral-400 uppercase">
          Route · {Math.round(trainFrac * 100)}%
        </span>
        <span className="font-mono text-[9px] font-semibold tracking-widest text-emerald-400/90 uppercase">
          Summit
        </span>
      </div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-[68px] w-full"
        role="img"
        aria-label="Route progress strip"
      >
        {/* Burned region behind the fire front. */}
        {fireX > 0 && (
          <rect
            x={0}
            y={0}
            width={fireX}
            height={VIEW_H}
            fill="url(#burned)"
            opacity={0.5}
          />
        )}
        <defs>
          <linearGradient id="burned" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#450a0a" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>
          <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="100%" stopColor="#18181b" />
          </linearGradient>
        </defs>

        {/* Elevation silhouette (hills). */}
        <polygon points={polygon} fill="url(#hill)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="#71717a"
          strokeWidth={1.5}
        />

        {/* Baseline rail. */}
        <line
          x1={0}
          y1={VIEW_H - BOTTOM_PAD + 12}
          x2={VIEW_W}
          y2={VIEW_H - BOTTOM_PAD + 12}
          stroke="#52525b"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Station markers. */}
        {stations.map((st) => {
          const sx = st.x * VIEW_W;
          const sy = TOP_PAD + (1 - st.y) * (VIEW_H - TOP_PAD - BOTTOM_PAD);
          return (
            <g key={st.id}>
              <line
                x1={sx}
                y1={sy}
                x2={sx}
                y2={VIEW_H - BOTTOM_PAD + 12}
                stroke="#3f3f46"
                strokeWidth={1}
              />
              <circle cx={sx} cy={sy} r={3.5} fill="#fbbf24" stroke="#1c1917" />
            </g>
          );
        })}

        {/* Fire front marker. */}
        {fireX >= 0 && fireX <= VIEW_W && (
          <g>
            <line
              x1={fireX}
              y1={0}
              x2={fireX}
              y2={VIEW_H}
              stroke="#f97316"
              strokeWidth={2}
            />
            <circle cx={fireX} cy={12} r={4} fill="#f97316">
              <animate
                attributeName="opacity"
                values="1;0.4;1"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}

        {/* Train marker. */}
        <g>
          <line
            x1={trainX}
            y1={0}
            x2={trainX}
            y2={VIEW_H}
            stroke="#38bdf8"
            strokeWidth={1}
            opacity={0.5}
          />
          <circle
            cx={trainX}
            cy={VIEW_H - BOTTOM_PAD + 12}
            r={5}
            fill="#38bdf8"
            stroke="#082f49"
          />
        </g>
      </svg>

      {/* Station labels row (HTML for crisp text). */}
      <div className="relative mt-0.5 h-3">
        {stations.map((st) => (
          <span
            key={st.id}
            className="absolute -translate-x-1/2 truncate font-mono text-[7px] tracking-wide text-neutral-500"
            style={{ left: `${st.x * 100}%`, maxWidth: "80px" }}
            title={st.name}
          >
            {st.name}
          </span>
        ))}
      </div>
    </div>
  );
}
