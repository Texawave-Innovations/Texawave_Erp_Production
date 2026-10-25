"use client";

import { use } from "react";
import { ProposalDetailView } from "@/features/proposals/components/ProposalDetailView";

export default function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return <ProposalDetailView id={Number(resolvedParams.id)} />;
}
