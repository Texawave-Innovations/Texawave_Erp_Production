"use client";

import { Suspense, use } from "react";
import { MomEditor } from "@/features/mom/components/MomEditor";

export default function MomEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <MomEditor mode="edit" id={Number(id)} />
    </Suspense>
  );
}
