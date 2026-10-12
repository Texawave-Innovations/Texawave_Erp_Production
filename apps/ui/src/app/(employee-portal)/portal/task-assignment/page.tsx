import { TasksView } from "@/features/hr/tasks/components/TasksView";

// Reuses the HR dashboard's Task Assignment screen as-is: it has no
// dashboard-specific layout assumptions, reads `usePermission` for gating,
// and the API already scopes results to the caller's team via
// `@TeamScoped()` (apps/api/src/modules/hr/tasks/tasks.repository.ts) — a
// Team Lead granted hr.task.read.team/write.team sees exactly their team's
// tasks here, same as an HR Manager would see all of them on the dashboard
// route. See Docs/ARCHITECTURE.md §7 for why this portal item is gated by an
// hr.* permission instead of employee_self_service.*.
export default function PortalTaskAssignmentPage() {
  return <TasksView />;
}
