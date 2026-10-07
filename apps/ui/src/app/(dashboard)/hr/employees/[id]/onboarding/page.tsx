import { notFound } from "next/navigation";
import { EmployeeOnboardingProgress } from "@/features/onboarding/components/EmployeeOnboardingProgress";

export default async function HrEmployeeOnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Employee onboarding
      </h1>
      <EmployeeOnboardingProgress employeeId={employeeId} />
    </div>
  );
}
