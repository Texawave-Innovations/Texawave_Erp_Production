"use client";

import { use } from "react";
import { ProposalTemplateBuilderView } from "@/features/proposals/components/ProposalTemplateBuilderView";

export default function ProposalTemplateBuilderPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <ProposalTemplateBuilderView
      templateId={Number(resolvedParams.templateId)}
    />
  );
}
