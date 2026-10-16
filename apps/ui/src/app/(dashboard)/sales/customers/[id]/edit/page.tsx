import { notFound } from "next/navigation";
import { CustomerEditView } from "@/features/sales/customers/components/CustomerFormView";

export default async function SalesCustomerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <CustomerEditView id={Number(id)} />;
}
