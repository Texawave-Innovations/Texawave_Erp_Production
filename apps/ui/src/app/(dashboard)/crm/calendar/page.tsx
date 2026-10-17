import { Suspense } from "react";
import { CrmCalendar } from "@/features/crm/calendar/components/CrmCalendar";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/calendar/` (Docs/CODING_STANDARDS.md §4). The calendar reads
// `useSearchParams()`, which needs a Suspense boundary.
export default function CrmCalendarPage() {
  return (
    <Suspense fallback={null}>
      <CrmCalendar />
    </Suspense>
  );
}
