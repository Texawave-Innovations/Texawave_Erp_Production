import { Suspense } from "react";
import { QuotationComparisonView } from "@/features/scm/procurement/components/QuotationComparisonView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md section 4).
export default function ScmComparisonPage() {
  return (
    <Suspense>
      <QuotationComparisonView />
    </Suspense>
  );
}
