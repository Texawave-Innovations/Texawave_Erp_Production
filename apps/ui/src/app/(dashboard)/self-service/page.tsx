"use client";

import { Card } from "@texawave-erp/ui-kit";
import { useMyEmployee } from "@/features/onboarding/hooks";

/** Landing page for a completed profile, rendered inside the dashboard shell
 * (sidebar) so self-service pages are actually reachable — unlike the old
 * (employee-portal) route group's /portal, which had no navigation at all. */
export default function SelfServiceHomePage() {
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
