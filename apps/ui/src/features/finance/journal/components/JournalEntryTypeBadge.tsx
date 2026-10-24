import type { FinanceJournalEntryType } from "@texawave-erp/api-types";
import { StatusBadge, type StatusColorToken } from "@texawave-erp/ui-kit";

export interface JournalEntryTypeBadgeProps {
  type: FinanceJournalEntryType | string;
  className?: string | undefined;
}

export function JournalEntryTypeBadge({
  type,
  className,
}: JournalEntryTypeBadgeProps) {
  let label = type;
  let colorToken: StatusColorToken = "gray";

  switch (type) {
    case "MANUAL":
      label = "Manual";
      colorToken = "gray";
      break;
    case "EXPENSE":
      label = "Expense";
      colorToken = "error";
      break;
    case "PAYMENT_RECEIVED":
      label = "Payment Received";
      colorToken = "success";
      break;
    case "PAYMENT_MADE":
      label = "Payment Made";
      colorToken = "warning";
      break;
    case "BANK_TRANSFER":
      label = "Bank Transfer";
      colorToken = "brand";
      break;
    case "OPENING_BALANCE":
      label = "Opening Balance";
      colorToken = "brand";
      break;
    case "REVERSAL":
      label = "Reversal";
      colorToken = "warning";
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
