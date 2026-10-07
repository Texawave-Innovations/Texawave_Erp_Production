import { HrDashboardView } from "@/features/hr/dashboard/components/HrDashboardView";

// `app/` stays thin — routing only. The dashboard lives in `features/hr/dashboard/`
// (Docs/CODING_STANDARDS.md §4).
export default function HrDashboardPage() {
  return <HrDashboardView />;
}
