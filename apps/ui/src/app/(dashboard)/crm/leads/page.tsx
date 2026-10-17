import { Suspense } from "react";
import { LeadList } from "@/features/crm/leads/components/LeadList";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/leads/` (Docs/CODING_STANDARDS.md §4). The list reads its view
// state from the URL query string, so it needs a Suspense boundary.
export default function CrmLeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadList />
    </Suspense>
  );
}
