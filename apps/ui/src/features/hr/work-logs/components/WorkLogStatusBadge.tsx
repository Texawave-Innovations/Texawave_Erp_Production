"use client";

import { StatusBadge } from "@texawave-erp/ui-kit";
import { STATUS_COLOR, STATUS_LABELS } from "../status";
import type { WorkLogStatus } from "../types";

/** Status always renders as text, never color alone (Docs/DESIGN_SYSTEM.md). */
export function WorkLogStatusBadge({ status }: { status: WorkLogStatus }) {
  return (
    <StatusBadge
      label={STATUS_LABELS[status]}
      colorToken={STATUS_COLOR[status]}
    />
  );
}
