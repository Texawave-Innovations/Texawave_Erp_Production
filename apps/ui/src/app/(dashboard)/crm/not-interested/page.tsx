import { NotInterestedQueue } from "@/features/crm/accounts/components/NotInterestedQueue";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/accounts/` (Docs/CODING_STANDARDS.md §4).
export default function CrmNotInterestedPage() {
  return <NotInterestedQueue />;
}
