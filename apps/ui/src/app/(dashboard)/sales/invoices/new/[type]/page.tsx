import { notFound } from "next/navigation";
import { InvoiceCreateView } from "@/features/sales/invoices/components/InvoiceFormView";

export default async function SalesInvoiceNewPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (type !== "proforma" && type !== "tax") notFound();
  return (
    <InvoiceCreateView invoiceType={type === "proforma" ? "PROFORMA" : "TAX"} />
  );
}
