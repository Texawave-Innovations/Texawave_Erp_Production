import { Suspense } from "react";
import { GoodsReceiptsView } from "@/features/scm/procurement/components/GoodsReceiptsView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md section 4).
export default function ScmGoodsReceiptsPage() {
  return (
    <Suspense>
      <GoodsReceiptsView />
    </Suspense>
  );
}
