import { Suspense } from "react";
import { TableSkeleton } from "@texawave-erp/ui-kit";
import { GeneralLedgerView } from "@/features/finance/journal/components/GeneralLedgerView";

export const metadata = {
  title: "General Ledger | TexaWave ERP",
  description: "Account-level General Ledger statement with running balances",
};

export default function GeneralLedgerPage() {
  return (
    <Suspense fallback={<TableSkeleton columnsCount={7} rowsCount={6} />}>
      <GeneralLedgerView />
    </Suspense>
  );
}
