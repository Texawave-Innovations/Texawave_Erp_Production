import type { DndRequest, DndState } from "./types";

export type DndPresetId = "30m" | "1h" | "2h" | "tomorrow" | "indefinite";

export const DND_PRESETS: readonly { id: DndPresetId; label: string }[] = [
  { id: "30m", label: "30 minutes" },
  { id: "1h", label: "1 hour" },
  { id: "2h", label: "2 hours" },
  { id: "tomorrow", label: "Until tomorrow 9:00 AM" },
  { id: "indefinite", label: "Until I turn it off" },
];

const MINUTE = 60_000;

/** The request body for a preset, relative to `now`. "Tomorrow" is 09:00 in
 * the user's own time zone. */
export function dndRequestFor(id: DndPresetId, now: Date): DndRequest {
  switch (id) {
    case "30m":
      return { until: new Date(now.getTime() + 30 * MINUTE).toISOString() };
    case "1h":
      return { until: new Date(now.getTime() + 60 * MINUTE).toISOString() };
    case "2h":
      return { until: new Date(now.getTime() + 120 * MINUTE).toISOString() };
    case "tomorrow": {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      t.setHours(9, 0, 0, 0);
      return { until: t.toISOString() };
    }
    case "indefinite":
      return { indefinite: true };
  }
}

/** Body that turns Do Not Disturb off. */
export const DND_OFF_REQUEST: DndRequest = { until: null, indefinite: false };

/** Short status line for the bell panel, e.g. "Do not disturb until 5:30 PM". */
export function describeDnd(state: DndState, now: Date = new Date()): string {
  if (!state.active) return "";
  if (state.indefinite || !state.until) {
    return "Do not disturb until you turn it off";
  }
  const until = new Date(state.until);
  const sameDay = until.toDateString() === now.toDateString();
  const time = until.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  if (sameDay) return `Do not disturb until ${time}`;
  const day = until.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `Do not disturb until ${day}, ${time}`;
}
