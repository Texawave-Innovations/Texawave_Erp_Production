import { notFound } from "next/navigation";
import { InvoiceDetailView } from "@/features/sales/invoices/components/InvoiceDetailView";

export default async function SalesInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <InvoiceDetailView id={Number(id)} />;
}
