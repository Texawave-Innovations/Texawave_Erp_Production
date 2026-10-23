import type { HealthStatus } from "../types";

export function HealthBadge({
  health,
}: {
  health?: HealthStatus | null | undefined;
}) {
  if (health === "ON_TRACK") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        On Track
      </span>
    );
  }

  if (health === "AT_RISK") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        At Risk
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
      "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-500/30",
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
