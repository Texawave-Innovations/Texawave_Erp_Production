import { QuotationList } from "@/features/crm/quotations/components/QuotationList";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/quotations/` (Docs/CODING_STANDARDS.md §4).
export default function CrmQuotesPage() {
  return <QuotationList />;
}
