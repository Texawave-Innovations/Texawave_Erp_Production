import { Suspense } from "react";
import { TableSkeleton } from "@texawave-erp/ui-kit";
import { ReportsView } from "@/features/finance/reports/components/ReportsView";

export const metadata = {
  title: "Financial Statements & Reports | TexaWave ERP",
  description:
    "Statutory financial statements: Balance Sheet, Profit & Loss, Trial Balance, and General Ledger",
};

export default function FinancialReportsPage() {
  return (
    <Suspense fallback={<TableSkeleton columnsCount={4} rowsCount={8} />}>
      <ReportsView />
    </Suspense>
  );
}
