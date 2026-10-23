import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeadDetail } from "@/features/crm/leads/components/LeadDetail";

export default async function CrmLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return (
    <Suspense fallback={null}>
      <LeadDetail leadId={Number(id)} />
    </Suspense>
  );
}
