import { StockLedgerView } from "@/features/scm/inventory/components/StockLedgerView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md §4).
export default function ScmStockLedgerPage() {
  return <StockLedgerView />;
}
