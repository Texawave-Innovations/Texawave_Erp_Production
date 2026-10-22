import { notFound } from "next/navigation";
import { DealDetail } from "@/features/crm/opportunities/components/DealDetail";

export default async function CrmDealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <DealDetail id={Number(id)} />;
}
