import { notFound } from "next/navigation";
import { RdcDetailView } from "@/features/sales/returnable-dcs/components/RdcViews";

export default async function SalesReturnableDcDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <RdcDetailView id={Number(id)} />;
}
