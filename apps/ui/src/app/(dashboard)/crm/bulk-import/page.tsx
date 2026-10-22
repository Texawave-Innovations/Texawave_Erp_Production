import { BulkImportPage } from "@/features/crm/bulk-import/components/BulkImportPage";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/bulk-import/` (Docs/CODING_STANDARDS.md §4).
export default function CrmBulkImportPage() {
  return <BulkImportPage />;
}
