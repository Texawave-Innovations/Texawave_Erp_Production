import { Suspense } from "react";
import { YetToHappenList } from "@/features/crm/yet-to-happen/components/YetToHappenList";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/yet-to-happen/` (Docs/CODING_STANDARDS.md §4). The list reads
// `?subTab=`, so it needs a Suspense boundary.
export default function CrmYetToHappenPage() {
  return (
    <Suspense fallback={null}>
      <YetToHappenList />
    </Suspense>
  );
}
