import { Suspense } from "react";
import { LeavesView } from "@/features/hr/leaves/components/LeavesView";

// `app/` stays thin — routing only. The screen lives in
// `features/hr/leaves/` (Docs/CODING_STANDARDS.md §4).
export default function HrLeavesPage() {
  return (
    /* LeavesView reads ?tab= (useSearchParams needs a Suspense boundary) */
    <Suspense fallback={null}>
      <LeavesView />
    </Suspense>
  );
}
