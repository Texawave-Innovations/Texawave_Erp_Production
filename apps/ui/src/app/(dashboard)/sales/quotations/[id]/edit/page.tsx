import { notFound } from "next/navigation";
import { QuotationEditView } from "@/features/sales/quotations/components/QuotationFormView";

export default async function SalesQuotationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <QuotationEditView id={Number(id)} />;
}
