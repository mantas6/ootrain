/**
 * Panel — a dark industrial container used by HUD readouts and station panels.
 *
 * Presentational only; no game state. Interactive descendants must re-enable
 * pointer events themselves when the HUD container disables them.
 */

import type { ReactNode } from "react";

interface PanelProps {
  /** Optional heading shown as a small uppercase label. */
  title?: string;
  /** Extra classes to merge onto the container. */
  className?: string;
  /** Re-enable pointer events on this panel (for interactive panels). */
  interactive?: boolean;
  children: ReactNode;
}

/** A bordered, semi-opaque dark panel with an optional amber-labelled header. */
export function Panel({
  title,
  className,
  interactive,
  children,
}: PanelProps): ReactNode {
  return (
    <div
      className={[
        "rounded-md border border-neutral-700/80 bg-neutral-900/80 shadow-lg backdrop-blur-sm",
        interactive === true ? "pointer-events-auto" : "",
        className ?? "",
      ].join(" ")}
    >
      {title !== undefined && (
        <div className="border-b border-neutral-700/60 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">
          {title}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
