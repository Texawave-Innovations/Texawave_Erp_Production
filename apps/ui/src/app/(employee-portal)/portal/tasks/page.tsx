import { MyTasksView } from "@/features/hr/tasks/components/MyTasksView";

// The one self-service tasks screen: the same view HR staff see for their own
// records (Docs/EMPLOYEE_SELF_SERVICE_API.md §4). `app/` stays thin —
// routing only (Docs/CODING_STANDARDS.md §4).
export default function PortalTasksPage() {
  return <MyTasksView />;
}
