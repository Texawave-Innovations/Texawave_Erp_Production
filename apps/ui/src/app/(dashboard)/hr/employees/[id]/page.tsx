import { notFound } from "next/navigation";
import { EmployeeDetailView } from "@/features/hr/employees/components/EmployeeDetailView";

export default async function HrEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <EmployeeDetailView id={Number(id)} />;
}
