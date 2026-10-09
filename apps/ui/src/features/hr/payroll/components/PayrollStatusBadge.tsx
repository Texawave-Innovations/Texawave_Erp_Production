import { StatusBadge, type StatusColorToken } from "@texawave-erp/ui-kit";
import type { PeriodStatus, RunStatus } from "../types";

const COLOR: Record<PeriodStatus | RunStatus, StatusColorToken> = {
  DRAFT: "gray",
  PROCESSING: "warning",
  PROCESSED: "brand",
  APPROVED: "success",
  FINALIZED: "success",
  CANCELLED: "error",
};

const LABEL: Record<PeriodStatus | RunStatus, string> = {
  DRAFT: "Draft",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  APPROVED: "Approved",
  FINALIZED: "Finalized",
  CANCELLED: "Cancelled",
};

export function PayrollStatusBadge({
  status,
}: {
  status: PeriodStatus | RunStatus;
}) {
  return <StatusBadge label={LABEL[status]} colorToken={COLOR[status]} />;
}

export function periodStatusLabel(status: PeriodStatus): string {
  return LABEL[status];
}
