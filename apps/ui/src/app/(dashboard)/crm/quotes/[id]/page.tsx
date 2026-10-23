import { notFound } from "next/navigation";
import { QuotationDetailView } from "@/features/crm/quotations/components/QuotationDetailView";

export default async function CrmQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <QuotationDetailView id={Number(id)} />;
}
