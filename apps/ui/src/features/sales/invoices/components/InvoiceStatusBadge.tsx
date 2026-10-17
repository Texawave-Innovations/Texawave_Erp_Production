import { StatusBadge } from "@texawave-erp/ui-kit";
import type { InvoiceStatus } from "../types";

const LABEL: Record<
  InvoiceStatus,
  { label: string; tone: "success" | "warning" | "error" | "gray" | "brand" }
> = {
  UNPAID: { label: "Unpaid", tone: "error" },
  PARTIALLY_PAID: { label: "Partially paid", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  CONVERTED: { label: "Moved to tax invoice", tone: "gray" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const s = LABEL[status];
  return <StatusBadge label={s.label} colorToken={s.tone} />;
}
