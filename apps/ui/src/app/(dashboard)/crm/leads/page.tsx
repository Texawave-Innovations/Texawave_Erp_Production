import { LeadList } from "@/features/crm/leads/components/LeadList";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/leads/` (Docs/CODING_STANDARDS.md §4).
export default function CrmLeadsPage() {
  return <LeadList />;
}
