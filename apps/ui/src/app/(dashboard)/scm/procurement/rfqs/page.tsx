import { Suspense } from "react";
import { RfqsView } from "@/features/scm/procurement/components/RfqsView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md section 4).
export default function ScmRfqsPage() {
  return (
    <Suspense>
      <RfqsView />
    </Suspense>
  );
}
