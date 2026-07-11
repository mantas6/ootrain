/**
 * ToastOverlay — brief, auto-dismissing positive-feedback notifications.
 *
 * Watches successive snapshots and surfaces the events produced by the pure
 * {@link detectToastEvents} diff (cargo delivered / money earned, emergency
 * fuel rescue, upgrade purchased). Each toast fades in, holds, and fades out
 * over ~3s (CSS `animate-toast`) before being removed from the DOM.
 *
 * All game/transition logic lives in the pure detector; this component only
 * turns detected events into short messages and manages their lifecycle, so
 * there is nothing here to unit test (no DOM tests, per the brief).
 */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useGame } from "../useGame";
import { getUpgradeById } from "../../game/data/upgrades";
import { formatMoney } from "../format";
import { detectToastEvents, type ToastEvent } from "./toastEvents";

/** How long each toast lives before removal, milliseconds (matches the CSS). */
const TOAST_LIFETIME_MS = 3000;

/** Visual tone for a toast (border/text accent). */
type ToastTone = "money" | "rescue" | "upgrade";

/** A live on-screen toast. */
interface Toast {
  /** Unique, monotonic id (React key). */
  id: number;
  /** Rendered message. */
  message: string;
  /** Accent tone. */
  tone: ToastTone;
}

/** Maps a detected event to a display message + tone. */
function toToast(event: ToastEvent, id: number): Toast {
  switch (event.kind) {
    case "money":
      return {
        id,
        tone: "money",
        message: `Delivered! +${formatMoney(event.amountEarned)}`,
      };
    case "rescue":
      return {
        id,
        tone: "rescue",
        message: "Rescue crew topped up your fuel",
      };
    case "upgrade": {
      const name = getUpgradeById(event.upgradeId)?.name ?? "Upgrade";
      return { id, tone: "upgrade", message: `Installed: ${name}` };
    }
  }
}

/** Tailwind accent classes per tone. */
const TONE_CLASS: Record<ToastTone, string> = {
  money: "border-emerald-500/70 text-emerald-200",
  rescue: "border-sky-500/70 text-sky-200",
  upgrade: "border-amber-500/70 text-amber-200",
};

/** Renders the top-center stack of transient event toasts. */
export function ToastOverlay(): ReactNode {
  const { snapshot } = useGame();
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Previous snapshot for the pure diff, and a monotonic id + timer registry.
  const prevRef = useRef<typeof snapshot | null>(null);
  const nextIdRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const events = detectToastEvents(prevRef.current, snapshot);
    prevRef.current = snapshot;
    if (events.length === 0) return;

    const added = events.map((e) => toToast(e, nextIdRef.current++));
    setToasts((cur) => [...cur, ...added]);

    for (const t of added) {
      const timer = setTimeout(() => {
        setToasts((cur) => cur.filter((x) => x.id !== t.id));
      }, TOAST_LIFETIME_MS);
      timersRef.current.push(timer);
    }
  }, [snapshot]);

  // Clear any pending timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute top-20 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "animate-toast rounded-md border bg-neutral-900/90 px-4 py-1.5 font-mono text-xs font-bold tracking-wide shadow-lg backdrop-blur-sm",
            TONE_CLASS[t.tone],
          ].join(" ")}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
