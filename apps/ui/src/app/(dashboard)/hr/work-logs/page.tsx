import { WorkLogsView } from "@/features/hr/work-logs/components/WorkLogsView";

// `app/` stays thin — routing only. The screen lives in `features/hr/work-logs/`
// (Docs/CODING_STANDARDS.md §4).
export default function HrWorkLogsPage() {
  return <WorkLogsView />;
}
