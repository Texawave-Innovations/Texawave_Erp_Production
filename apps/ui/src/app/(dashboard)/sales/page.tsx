import { Suspense } from "react";
import { SalesWorkspaceView } from "@/features/sales/components/SalesWorkspaceView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md §4).
export default function SalesPage() {
  return (
    <Suspense>
      <SalesWorkspaceView />
    </Suspense>
  );
}
