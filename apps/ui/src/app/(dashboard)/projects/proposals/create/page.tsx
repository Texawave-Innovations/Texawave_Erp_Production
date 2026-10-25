"use client";

import { Suspense } from "react";
import { CreateProposalView } from "@/features/proposals/components/CreateProposalView";

export default function CreateProposalPage() {
  // useSearchParams (?projectId=) inside the view needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <CreateProposalView />
    </Suspense>
  );
}
