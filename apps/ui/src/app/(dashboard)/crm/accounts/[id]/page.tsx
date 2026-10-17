import { notFound } from "next/navigation";
import { AccountDetail } from "@/features/crm/accounts/components/AccountDetail";

export default async function CrmAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <AccountDetail id={Number(id)} />;
}
