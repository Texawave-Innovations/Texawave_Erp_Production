import { notFound } from "next/navigation";
import { CustomerDetailView } from "@/features/sales/customers/components/CustomerDetailView";

export default async function SalesCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <CustomerDetailView id={Number(id)} />;
}
