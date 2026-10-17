import { notFound } from "next/navigation";
import { ChallanEditView } from "@/features/sales/delivery-challans/components/ChallanViews";

export default async function SalesDeliveryChallanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <ChallanEditView id={Number(id)} />;
}
