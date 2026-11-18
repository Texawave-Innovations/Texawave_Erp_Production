import { Suspense } from "react";
import { PurchasesView } from "@/features/purchases/components/PurchasesView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md §4).
export default function PurchasesPage() {
  return (
    <Suspense>
      <PurchasesView />
    </Suspense>
  );
}
