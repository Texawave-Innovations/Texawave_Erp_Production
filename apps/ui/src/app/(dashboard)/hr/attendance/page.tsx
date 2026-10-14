import { AttendanceView } from "@/features/hr/attendance/components/AttendanceView";

// `app/` stays thin — routing only. The screen lives in `features/hr/attendance/`
// (Docs/CODING_STANDARDS.md §4).
export default function HrAttendancePage() {
  return <AttendanceView />;
}
