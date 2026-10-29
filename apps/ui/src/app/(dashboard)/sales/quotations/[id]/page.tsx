import { notFound } from "next/navigation";
import { QuotationDetailView } from "@/features/sales/quotations/components/QuotationDetailView";

export default async function SalesQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <QuotationDetailView id={Number(id)} />;
}
