"use client";

import { StatusBadge } from "@texawave-erp/ui-kit";
import { STATUS_COLOR, STATUS_LABELS } from "../status";
import type { EffectiveStatus } from "../types";

/** Status always renders as text, never color alone (Docs/DESIGN_SYSTEM.md).
 * `pending`: the system auto-closed a session on this day and HR has not yet
 * regularized it, so the day is shown as awaiting HR instead of as worked. */
export function AttendanceStatusBadge({
  status,
  pending = false,
}: {
  status: EffectiveStatus;
  pending?: boolean | undefined;
}) {
  if (pending && status === "NOT_MARKED") {
    return <StatusBadge label="Pending HR" colorToken="warning" />;
  }
  return (
    <StatusBadge
      label={STATUS_LABELS[status]}
      colorToken={STATUS_COLOR[status]}
    />
  );
}
