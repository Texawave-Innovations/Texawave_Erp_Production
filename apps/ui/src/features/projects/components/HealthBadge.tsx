import type { HealthStatus } from "../types";

export type NormalizedHealth = "ON_TRACK" | "DELAYED" | "COMPLETED";

/** The API sends lower-case `on_track`/`delayed`/`completed`; older UI code
 * used upper-case — normalize both so filters and badges agree. Legacy only
 * has a two-state health model (On Track / Delayed), plus Completed. */
export function normalizeHealth(
  health: HealthStatus | string | null | undefined,
): NormalizedHealth | null {
  switch ((health ?? "").toLowerCase()) {
    case "on_track":
      return "ON_TRACK";
    case "delayed":
      return "DELAYED";
    case "completed":
      return "COMPLETED";
    default:
      return null;
  }
}

export function HealthBadge({
  health: rawHealth,
}: {
  health?: HealthStatus | null | undefined;
}) {
  const health = normalizeHealth(rawHealth);
  if (health === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Delivered
      </span>
    );
  }

  if (health === "ON_TRACK") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        On Track
      </span>
    );
  }

  if (health === "DELAYED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Delayed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20 dark:bg-gray-800 dark:text-gray-400">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Not Set
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status?: string | null | undefined;
}) {
  const normalized = (status || "").toLowerCase();
  const styles: Record<string, string> = {
    active:
      "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-500/30",
    in_progress:
      "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-500/30",
    completed:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30",
    on_hold:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-500/30",
    hold: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-500/30",
    cancelled:
      "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-500/30",
    not_started:
      "bg-gray-100 text-gray-700 ring-gray-600/20 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
  };

  const labels: Record<string, string> = {
    active: "Active",
    in_progress: "In Progress",
    completed: "Completed",
    on_hold: "On Hold",
    hold: "Hold",
    cancelled: "Cancelled",
    not_started: "Not Started",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        styles[normalized] ?? styles.not_started
      }`}
    >
      {labels[normalized] ?? (status || "Unknown")}
    </span>
  );
}

export function PriorityBadge({
  priority,
}: {
  priority?: string | null | undefined;
}) {
  const normalized = (priority || "").toLowerCase();
  const styles: Record<string, string> = {
    low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    medium: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    urgent:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 font-bold animate-pulse",
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${
        styles[normalized] ?? styles.medium
      }`}
    >
      {priority || "MEDIUM"}
    </span>
  );
}
