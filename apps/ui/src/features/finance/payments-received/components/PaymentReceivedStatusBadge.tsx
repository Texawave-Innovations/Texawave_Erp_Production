import type { FinancePaymentReceivedStatus } from "@texawave-erp/api-types";
import { StatusBadge, type StatusColorToken } from "@texawave-erp/ui-kit";

export interface PaymentReceivedStatusBadgeProps {
  status: FinancePaymentReceivedStatus | string;
  className?: string | undefined;
}

export function PaymentReceivedStatusBadge({
  status,
  className,
}: PaymentReceivedStatusBadgeProps) {
  let label = status;
  let colorToken: StatusColorToken = "gray";

  switch (status) {
    case "CONFIRMED":
      label = "Confirmed";
      colorToken = "brand";
      break;
    case "DRAFT":
      label = "Draft";
      colorToken = "gray";
      break;
    case "RECONCILED":
      label = "Reconciled";
      colorToken = "success";
      break;
    case "VOID":
      label = "Void";
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
