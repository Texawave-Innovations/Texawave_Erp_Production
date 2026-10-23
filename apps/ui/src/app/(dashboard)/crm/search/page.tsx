import { CrmSearchPage } from "@/features/crm/search/components/CrmSearchPage";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/search/` (Docs/CODING_STANDARDS.md §4).
export default function CrmSearchRoutePage() {
  return <CrmSearchPage />;
}
