import { TeamTimesheetsView } from "@/features/timesheets/components/TeamTimesheetsView";

// HR workspace entry for the same review screen (menu code hr-timesheets, gated
// by hr.timesheet.read.*). HR holds `.all`, so it sees every employee and gives
// the second approval (or decides alone when there is no reporting manager).
export default function HrTimesheetsPage() {
  return <TeamTimesheetsView />;
}
