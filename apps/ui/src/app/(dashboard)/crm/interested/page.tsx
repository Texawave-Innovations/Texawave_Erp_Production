import { InterestedQueue } from "@/features/crm/accounts/components/InterestedQueue";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/accounts/` (Docs/CODING_STANDARDS.md §4).
export default function CrmInterestedPage() {
  return <InterestedQueue />;
}
