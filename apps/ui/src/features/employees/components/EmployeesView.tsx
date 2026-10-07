"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useState } from "react";
import { useEmployees } from "../hooks";
import type { EmployeeListRow } from "../api";

const PAGE_SIZE = 10;

export function EmployeesView() {
  const [page, setPage] = useState(1);
  const query = useEmployees({ page, limit: PAGE_SIZE });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="Access Denied">
          You do not have permission to view employees.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const employees = query.data.data;
  const meta = query.data.meta;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Employees
      </h1>

      {employees.length === 0 ? (
        <Card>
          <EmptyState
            title="No employees yet"
            description="Create a new hire to add the first employee."
          />
        </Card>
      ) : (
        <>
          <DataTable<EmployeeListRow>
            columns={[
              { header: "Code", cell: (e) => e.employeeCode },
              { header: "Name", cell: (e) => e.fullName },
              { header: "Team", cell: (e) => e.team.name },
              { header: "Designation", cell: (e) => e.designation.name },
              {
                header: "Onboarding",
                cell: (e) => (
                  <StatusBadge
                    label={
                      e.onboardingStatus === "COMPLETE"
                        ? "Complete"
                        : "In progress"
                    }
                    colorToken={
                      e.onboardingStatus === "COMPLETE" ? "success" : "warning"
                    }
                  />
                ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (e) => (
                  <Link
                    href={`/hr/employees/${e.id}/onboarding`}
                    aria-label={`View onboarding for ${e.fullName}`}
                    className="text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-500"
                  >
                    View onboarding
                  </Link>
                ),
              },
            ]}
            rows={employees}
            getRowKey={(e) => String(e.id)}
          />
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
