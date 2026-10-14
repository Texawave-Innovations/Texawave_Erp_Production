import { HolidaysView } from "@/features/hr/holidays/components/HolidaysView";

// `app/` stays thin — routing only. The screen lives in `features/hr/holidays/`
// (Docs/CODING_STANDARDS.md §4).
export default function HrHolidaysPage() {
  return <HolidaysView />;
}
