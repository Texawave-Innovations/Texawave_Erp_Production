"use client";

import { use } from "react";
import { MomTemplateBuilderView } from "@/features/mom/components/MomTemplateBuilderView";

export default function MomTemplateBuilderPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <MomTemplateBuilderView templateId={Number(resolvedParams.templateId)} />
  );
}
