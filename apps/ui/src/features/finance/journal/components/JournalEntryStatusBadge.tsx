import type { FinanceJournalEntryStatus } from "@texawave-erp/api-types";
import { StatusBadge, type StatusColorToken } from "@texawave-erp/ui-kit";

export interface JournalEntryStatusBadgeProps {
  status: FinanceJournalEntryStatus | string;
  className?: string | undefined;
}

export function JournalEntryStatusBadge({
  status,
  className,
}: JournalEntryStatusBadgeProps) {
  let label = status;
  let colorToken: StatusColorToken = "gray";

  switch (status) {
    case "POSTED":
      label = "Posted";
      colorToken = "success";
      break;
    case "DRAFT":
      label = "Draft";
      colorToken = "gray";
      break;
    case "REVERSED":
      label = "Reversed";
      colorToken = "warning";
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
