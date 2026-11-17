import { MyTimesheetView } from "@/features/timesheets/components/MyTimesheetView";

// "My Timesheet" portal tab (menu code portal-timesheet, gated by
// employee_self_service.timesheet.read): the signed-in employee's own work by
// day. Every call it makes is own-data. `app/` stays thin — routing only.
export default function PortalTimesheetPage() {
  return <MyTimesheetView />;
}
