import { Suspense } from "react";
import { QuotationsView } from "@/features/scm/procurement/components/QuotationsView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md section 4).
export default function ScmQuotationsPage() {
  return (
    <Suspense>
      <QuotationsView />
    </Suspense>
  );
}
