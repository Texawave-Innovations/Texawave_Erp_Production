import { InvoicesView } from "@/features/sales/invoices/components/InvoicesView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md §4).
export default function SalesProformaInvoicesPage() {
  return <InvoicesView invoiceType="PROFORMA" />;
}
