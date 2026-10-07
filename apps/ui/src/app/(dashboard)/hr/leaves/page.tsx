import { LeavesView } from "@/features/hr/leaves/components/LeavesView";

// `app/` stays thin — routing only. The screen lives in
// `features/hr/leaves/` (Docs/CODING_STANDARDS.md §4).
export default function HrLeavesPage() {
  return <LeavesView />;
}
