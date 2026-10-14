"use client";

import { Card } from "@texawave-erp/ui-kit";
import { useMyEmployee } from "@/features/onboarding/hooks";

/** Landing page for a completed profile. The rest of the employee portal
 * (leave, payslips, attendance) is separate, later work. */
export default function PortalHomePage() {
  const employee = useMyEmployee();
  return (
    <Card className="p-6">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-gray-100">
        Welcome{employee.data ? `, ${employee.data.fullName}` : ""}
      </h1>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        Your profile is complete.
      </p>
    </Card>
  );
}
