import { MyWorkLogsView } from "@/features/hr/work-logs/components/MyWorkLogsView";

// The one self-service work-logs screen: the same view HR staff see for their own
// records (Docs/EMPLOYEE_SELF_SERVICE_API.md §4). `app/` stays thin —
// routing only (Docs/CODING_STANDARDS.md §4).
export default function PortalWorkLogsPage() {
  return <MyWorkLogsView />;
}
