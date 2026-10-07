import { notFound } from "next/navigation";
import { EmployeeEditView } from "@/features/hr/employees/components/EmployeeFormView";

export default async function HrEmployeeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <EmployeeEditView id={Number(id)} />;
}
