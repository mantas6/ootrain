/**
 * MuteButton — a tiny standalone mute toggle for the HUD.
 *
 * The only UI addition the audio layer needs. It owns no game rules and no
 * audio nodes: it just reflects a boolean and calls back to toggle it. App.tsx
 * wires it to the {@link AudioEngine}'s mute state.
 */

import type { ReactNode } from "react";

interface MuteButtonProps {
  /** Whether audio is currently muted. */
  muted: boolean;
  /** Toggle audio mute. */
  onToggle: () => void;
}

/** Small square button showing a speaker on/off glyph. */
export function MuteButton({ muted, onToggle }: MuteButtonProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      title={muted ? "Unmute audio" : "Mute audio"}
      className={[
        "pointer-events-auto rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest uppercase backdrop-blur-sm",
        muted
          ? "border-neutral-600 bg-neutral-800/90 text-neutral-500 hover:border-neutral-400"
          : "border-amber-500 bg-amber-500/20 text-amber-200",
      ].join(" ")}
    >
      {muted ? "Muted" : "Sound"}
    </button>
  );
}
