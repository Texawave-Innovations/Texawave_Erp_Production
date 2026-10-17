import { notFound } from "next/navigation";
import { InvoiceEditView } from "@/features/sales/invoices/components/InvoiceFormView";

export default async function SalesInvoiceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <InvoiceEditView id={Number(id)} />;
}
