import { MyAttendanceTrackerView } from "@/features/employee-self-service/attendance/components/MyAttendanceTrackerView";

// "Attendance" portal tab: the legacy-style attendance tracker (week/day
// timeline, month calendar, regularization). `app/` stays thin — routing only.
export default function PortalAttendancePage() {
  return <MyAttendanceTrackerView />;
}
