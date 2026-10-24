import type { FinanceAccountType } from "@texawave-erp/api-types";
import { StatusBadge } from "@texawave-erp/ui-kit";
import { accountTypeColorToken, formatAccountType } from "../../shared/format";

export interface AccountBadgeProps {
  type: FinanceAccountType | string;
  className?: string | undefined;
}

export function AccountBadge({ type, className }: AccountBadgeProps) {
  const label = formatAccountType(type);
  const colorToken = accountTypeColorToken(type);

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
