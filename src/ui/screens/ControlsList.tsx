/**
 * ControlsList — the shared how-to-play key reference.
 *
 * Reused by the start screen and the pause overlay so the keyboard mapping is
 * described in exactly one place. Presentational only.
 */

import type { ReactNode } from "react";

/** The canonical key -> action list (mirrors input/controls.ts). */
const CONTROLS: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: "W / ↑", action: "Throttle up" },
  { keys: "S / ↓", action: "Throttle down" },
  { keys: "Space", action: "Brake (hold)" },
  { keys: "R", action: "Toggle reverse" },
  { keys: "E", action: "Interact at station" },
  { keys: "Tab / M", action: "Toggle map" },
  { keys: "P / Esc", action: "Pause" },
  { keys: "N", action: "Mute / unmute" },
];

/** A compact two-column key reference. */
export function ControlsList(): ReactNode {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-left">
      {CONTROLS.map((c) => (
        <div key={c.keys} className="contents">
          <dt className="font-mono text-[11px] font-bold tracking-wider text-amber-300">
            {c.keys}
          </dt>
          <dd className="font-mono text-[11px] text-neutral-300">{c.action}</dd>
        </div>
      ))}
    </dl>
  );
}
