import { notFound } from "next/navigation";
import { ChallanDetailView } from "@/features/sales/delivery-challans/components/ChallanViews";

export default async function SalesDeliveryChallanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <ChallanDetailView id={Number(id)} />;
}
