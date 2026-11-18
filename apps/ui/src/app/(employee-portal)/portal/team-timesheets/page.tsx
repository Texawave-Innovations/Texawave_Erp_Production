import { TeamTimesheetsView } from "@/features/timesheets/components/TeamTimesheetsView";

// "Team Timesheets" portal tab (menu code portal-team-timesheets, gated by
// hr.timesheet.read.*): submitted days of the people the caller reviews. The
// API scopes every row to the caller's own/team/all permission; the decision
// buttons show only when the server says the caller may decide that day.
export default function PortalTeamTimesheetsPage() {
  return <TeamTimesheetsView />;
}
