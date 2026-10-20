import { notFound } from "next/navigation";
import { SupplierDetail } from "@/features/scm/suppliers/components/SupplierDetail";

export default async function ScmSupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <SupplierDetail id={Number(id)} />;
}
