import { AttendanceView } from "@/features/hr/attendance/components/AttendanceView";

// A Team Lead's "Team Attendance" portal tab (menu code portal-team-attendance,
// gated by hr.attendance.read.*). Reuses the HR screen as-is: the API scopes
// the rows to the caller's team via @TeamScoped(), so a .team holder sees
// exactly their team here. Docs/MENU_NAVIGATION_API.md §5.1.
export default function PortalTeamAttendancePage() {
  return <AttendanceView />;
}
