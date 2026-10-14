import { ExitRequestsView } from "@/features/hr/exit-requests/components/ExitRequestsView";

// `app/` stays thin — routing only. The screen lives in
// `features/hr/exit-requests/` (Docs/CODING_STANDARDS.md §4).
export default function HrExitRequestsPage() {
  return <ExitRequestsView />;
}
