import { notFound } from "next/navigation";
import { InventoryProductDetail } from "@/features/scm/inventory/components/InventoryProductDetail";

export default async function ScmInventoryProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  if (!/^\d+$/.test(productId)) notFound();
  return <InventoryProductDetail productId={Number(productId)} />;
}
