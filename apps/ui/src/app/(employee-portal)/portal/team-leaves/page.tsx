import { LeavesView } from "@/features/hr/leaves/components/LeavesView";

// A Team Lead's "Team Leaves" portal tab (menu code portal-team-leaves, gated
// by hr.leave_request.read.*). Reuses the HR screen as-is: the API scopes the
// rows to the caller's team via @TeamScoped(), and approve/reject buttons
// show only with hr.leave.approve.*. Docs/MENU_NAVIGATION_API.md §5.1.
export default function PortalTeamLeavesPage() {
  return <LeavesView />;
}
