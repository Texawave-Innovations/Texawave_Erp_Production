import { MyTasksView } from "@/features/hr/tasks/components/MyTasksView";

// `app/` stays thin — routing only. The screen lives in `features/hr/tasks/`
// (Docs/CODING_STANDARDS.md §4).
export default function SelfServiceTasksPage() {
  return <MyTasksView />;
}
