import type { FinanceExpenseStatus } from "@texawave-erp/api-types";
import { StatusBadge, type StatusColorToken } from "@texawave-erp/ui-kit";

export interface ExpenseStatusBadgeProps {
  status: FinanceExpenseStatus | string;
  className?: string | undefined;
}

export function ExpenseStatusBadge({
  status,
  className,
}: ExpenseStatusBadgeProps) {
  let label = status;
  let colorToken: StatusColorToken = "gray";

  switch (status) {
    case "PAID":
      label = "Paid";
      colorToken = "success";
      break;
    case "APPROVED":
      label = "Approved";
      colorToken = "brand";
      break;
    case "PENDING_APPROVAL":
      label = "Pending Approval";
      colorToken = "warning";
      break;
    case "DRAFT":
      label = "Draft";
      colorToken = "gray";
      break;
    case "CANCELLED":
      label = "Cancelled";
      colorToken = "error";
      break;
  }

  if (className !== undefined) {
    return (
      <StatusBadge
        label={label}
        colorToken={colorToken}
        className={className}
      />
    );
  }
  return <StatusBadge label={label} colorToken={colorToken} />;
}
