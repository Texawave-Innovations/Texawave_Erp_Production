import { Suspense } from "react";
import { PurchaseOrdersView } from "@/features/scm/procurement/components/PurchaseOrdersView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md section 4).
export default function ScmPurchaseOrdersPage() {
  return (
    <Suspense>
      <PurchaseOrdersView />
    </Suspense>
  );
}
