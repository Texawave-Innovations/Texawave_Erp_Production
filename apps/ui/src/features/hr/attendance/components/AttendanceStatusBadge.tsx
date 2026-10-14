"use client";

import { StatusBadge } from "@texawave-erp/ui-kit";
import { STATUS_COLOR, STATUS_LABELS } from "../status";
import type { EffectiveStatus } from "../types";

/** Status always renders as text, never color alone (Docs/DESIGN_SYSTEM.md). */
export function AttendanceStatusBadge({ status }: { status: EffectiveStatus }) {
  return (
    <StatusBadge
      label={STATUS_LABELS[status]}
      colorToken={STATUS_COLOR[status]}
    />
  );
}
