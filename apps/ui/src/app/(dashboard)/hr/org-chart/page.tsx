import { OrgChartView } from "@/features/hr/org-chart/components/OrgChartView";

// `app/` stays thin — routing only. The screen lives in `features/hr/org-chart/`
// (Docs/CODING_STANDARDS.md §4).
export default function HrOrgChartPage() {
  return <OrgChartView />;
}
