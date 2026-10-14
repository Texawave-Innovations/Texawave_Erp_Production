"use client";

import { StatusBadge } from "@texawave-erp/ui-kit";
import { STATUS_COLOR, STATUS_LABELS } from "../status";
import type { AwaitingStage, LeaveStatus } from "../types";

/** Status always renders as text, never color alone (Docs/DESIGN_SYSTEM.md).
 * A two-level request that has its first approval reads "Awaiting HR". */
export function LeaveStatusBadge({
  status,
  awaiting = null,
}: {
  status: LeaveStatus;
  awaiting?: AwaitingStage | null;
}) {
  if (status === "PENDING" && awaiting === "HR") {
    return <StatusBadge label="Awaiting HR" colorToken="brand" />;
  }
  return (
    <StatusBadge
      label={STATUS_LABELS[status]}
      colorToken={STATUS_COLOR[status]}
    />
  );
}
