import { ColdCallingList } from "@/features/crm/cold-calling/components/ColdCallingList";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/cold-calling/` (Docs/CODING_STANDARDS.md §4).
export default function CrmColdCallingStatusPage() {
  return <ColdCallingList />;
}
