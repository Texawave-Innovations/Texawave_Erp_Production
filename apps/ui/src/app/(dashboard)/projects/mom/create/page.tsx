"use client";

import { Suspense } from "react";
import { MomEditor } from "@/features/mom/components/MomEditor";

export default function CreateMomPage() {
  // useSearchParams (?projectId=) inside the editor needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <MomEditor mode="create" />
    </Suspense>
  );
}
