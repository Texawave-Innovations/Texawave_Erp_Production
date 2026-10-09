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

/** Loan, repayment, skip-request, bonus and contribution statuses. */
const OTHER: Record<string, { label: string; color: StatusColorToken }> = {
  ACTIVE: { label: "Active", color: "brand" },
  CLOSED: { label: "Closed", color: "success" },
  DEFAULTED: { label: "Defaulted", color: "error" },
  CANCELLED: { label: "Cancelled", color: "gray" },
  PENDING: { label: "Pending", color: "warning" },
  PAID: { label: "Paid", color: "success" },
  SKIPPED: { label: "Skipped", color: "gray" },
  APPROVED: { label: "Approved", color: "success" },
  REJECTED: { label: "Rejected", color: "error" },
  CREDITED: { label: "Credited", color: "success" },
  FAILED: { label: "Failed", color: "error" },
};

export function StatusPill({ status }: { status: string }) {
  const s = OTHER[status] ?? { label: status, color: "gray" as const };
  return <StatusBadge label={s.label} colorToken={s.color} />;
}

export function statusLabel(status: string): string {
  return OTHER[status]?.label ?? status;
}
