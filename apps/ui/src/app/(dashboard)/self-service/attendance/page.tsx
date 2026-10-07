import { MyAttendanceView } from "@/features/hr/attendance/components/MyAttendanceView";

// `app/` stays thin — routing only. The screen lives in `features/hr/attendance/`
// (Docs/CODING_STANDARDS.md §4).
export default function SelfServiceAttendancePage() {
  return <MyAttendanceView />;
}
