import {
  StatusBadge as KitStatusBadge,
  type StatusColorToken,
} from "@texawave-erp/ui-kit";
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

const HEALTH_BADGE: Record<
  NormalizedHealth,
  { label: string; token: StatusColorToken }
> = {
  ON_TRACK: { label: "On Track", token: "success" },
  DELAYED: { label: "Delayed", token: "error" },
  COMPLETED: { label: "Delivered", token: "brand" },
};

/** Project health, rendered through the shared ui-kit `StatusBadge`. */
export function HealthBadge({
  health: rawHealth,
}: {
  health?: HealthStatus | null | undefined;
}) {
  const health = normalizeHealth(rawHealth);
  const badge = health
    ? HEALTH_BADGE[health]
    : { label: "Not Set", token: "gray" as const };
  return <KitStatusBadge label={badge.label} colorToken={badge.token} />;
}

const STATUS_BADGE: Record<string, { label: string; token: StatusColorToken }> =
  {
    active: { label: "Active", token: "brand" },
    in_progress: { label: "In Progress", token: "brand" },
    completed: { label: "Completed", token: "success" },
    on_hold: { label: "On Hold", token: "warning" },
    hold: { label: "Hold", token: "warning" },
    cancelled: { label: "Cancelled", token: "error" },
    not_started: { label: "Not Started", token: "gray" },
  };

/** Project / task / milestone status, rendered through the ui-kit `StatusBadge`. */
export function StatusBadge({
  status,
}: {
  status?: string | null | undefined;
}) {
  const normalized = (status || "").toLowerCase();
  const badge = STATUS_BADGE[normalized] ?? {
    label: status || "Unknown",
    token: "gray" as const,
  };
  return <KitStatusBadge label={badge.label} colorToken={badge.token} />;
}

const PRIORITY_BADGE: Record<string, StatusColorToken> = {
  low: "gray",
  medium: "brand",
  high: "warning",
  urgent: "error",
};

export function PriorityBadge({
  priority,
}: {
  priority?: string | null | undefined;
}) {
  const normalized = (priority || "medium").toLowerCase();
  return (
    <KitStatusBadge
      label={normalized.charAt(0).toUpperCase() + normalized.slice(1)}
      colorToken={PRIORITY_BADGE[normalized] ?? "brand"}
    />
  );
}
