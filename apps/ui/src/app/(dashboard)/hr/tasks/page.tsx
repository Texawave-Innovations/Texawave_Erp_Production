import { TasksView } from "@/features/hr/tasks/components/TasksView";

// `app/` stays thin — routing only. The screen lives in `features/hr/tasks/`
// (Docs/CODING_STANDARDS.md §4).
export default function HrTasksPage() {
  return <TasksView />;
}
