import { notFound } from "next/navigation";
import { RdcEditView } from "@/features/sales/returnable-dcs/components/RdcViews";

export default async function SalesReturnableDcEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <RdcEditView id={Number(id)} />;
}
