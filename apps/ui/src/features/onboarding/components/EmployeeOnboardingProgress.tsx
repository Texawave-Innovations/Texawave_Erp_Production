"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  ErrorState,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import { useQuery } from "@tanstack/react-query";
import { getEmployeeOnboarding } from "../api";
import { MISSING_LABELS } from "./OnboardingWizard";

/** HR's read-only view of one employee's onboarding (no edit controls). */
export function EmployeeOnboardingProgress({
  employeeId,
}: {
  employeeId: number;
}) {
  const query = useQuery({
    queryKey: ["onboarding", "hr-progress", employeeId],
    queryFn: () => getEmployeeOnboarding(employeeId),
  });

  if (query.isPending) return <Skeleton className="h-32 w-full" />;

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="Access Denied">
          You do not have permission to view this employee&apos;s onboarding.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const done = query.data.onboardingStatus === "COMPLETE";
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-gray-100">
          Onboarding
        </h2>
        <StatusBadge
          label={done ? "Complete" : "In progress"}
          colorToken={done ? "success" : "warning"}
        />
      </div>
      {query.data.missing.length === 0 ? (
        <p className="mt-4 text-theme-sm text-gray-600 dark:text-gray-400">
          Nothing is missing.
        </p>
      ) : (
        <ul className="mt-4 list-disc pl-5 text-theme-sm text-gray-700 dark:text-gray-300">
          {query.data.missing.map((key) => (
            <li key={key}>
              {MISSING_LABELS[key] ?? key.replace(/^document\./, "Document: ")}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
