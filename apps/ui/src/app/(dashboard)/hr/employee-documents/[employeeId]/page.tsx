import { notFound } from "next/navigation";
import { EmployeeDocumentsDetailView } from "@/features/hr/employee-documents/components/EmployeeDocumentsDetailView";

export default async function HrEmployeeDocumentsDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  if (!/^\d+$/.test(employeeId)) notFound();
  return <EmployeeDocumentsDetailView employeeId={Number(employeeId)} />;
}
