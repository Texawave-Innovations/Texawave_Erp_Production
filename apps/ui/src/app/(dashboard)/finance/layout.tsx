import type { ReactNode } from "react";
import { FinanceShell } from "@/features/finance/shared/components/FinanceShell";

/**
 * Shared Finance Module Layout
 *
 * Wraps every /finance/* page with the Unified Financial Hub workspace shell:
 * - Module title & subtitle
 * - Six primary section navigation tabs (Expenses, Payments Received, Payments Made, Banking, Accounting, GST)
 * - Contextual sub-navigation bar
 */
export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <FinanceShell>{children}</FinanceShell>;
}
