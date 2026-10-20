import { Suspense } from "react";
import { FulfillmentsView } from "@/features/scm/fulfillment/components/FulfillmentsView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md section 4).
export default function ScmFulfillmentPage() {
  return (
    <Suspense>
      <FulfillmentsView />
    </Suspense>
  );
}
