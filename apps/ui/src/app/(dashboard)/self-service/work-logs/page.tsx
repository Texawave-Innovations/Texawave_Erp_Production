import { MyWorkLogsView } from "@/features/hr/work-logs/components/MyWorkLogsView";

// `app/` stays thin — routing only. The screen lives in `features/hr/work-logs/`
// (Docs/CODING_STANDARDS.md §4).
export default function SelfServiceWorkLogsPage() {
  return <MyWorkLogsView />;
}
