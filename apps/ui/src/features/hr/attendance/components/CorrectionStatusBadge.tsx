"use client";

import { StatusBadge } from "@texawave-erp/ui-kit";
import { CORRECTION_STATUS_COLOR, CORRECTION_STATUS_LABELS } from "../status";
import type { CorrectionStatus } from "../types";

/** Status always renders as text, never color alone (Docs/DESIGN_SYSTEM.md). */
export function CorrectionStatusBadge({
  status,
}: {
  status: CorrectionStatus;
}) {
  return (
    <StatusBadge
      label={CORRECTION_STATUS_LABELS[status]}
      colorToken={CORRECTION_STATUS_COLOR[status]}
    />
  );
}
