"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue, useEmployees } from "../../employees/hooks";
import { READ_ANY_SCOPE } from "../../employees/permissions";

const PAGE_SIZE = 20;
const DOCUMENT_READ_SCOPE = [
  "hr.employee_document.read.own",
  "hr.employee_document.read.team",
  "hr.employee_document.read.all",
] as const;

/** "All Employees Document List" — reuses the same employee roster the HR
 * employees directory lists (GET /hr/employees), since onboarding/HR
 * documents are always viewed per-employee, not queried on their own. */
export function EmployeeDocumentsListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());

  const canReadEmployees = usePermission(READ_ANY_SCOPE);
  const canReadDocuments = usePermission(DOCUMENT_READ_SCOPE);

  const list = useEmployees({
    page,
    limit: PAGE_SIZE,
    sortBy: "fullName",
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  if (!canReadEmployees || !canReadDocuments) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to employee documents"
      >
        Ask an administrator for the <code>hr.employee_document.read</code>{" "}
        permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-gradient-to-r from-green-500 to-lime-500 p-6 text-white">
        <h1 className="text-theme-xl font-bold">Employee Documents</h1>
        <p className="mt-1 text-white/90">
          View and download all uploaded documents
        </p>
        {list.data ? (
          <span className="mt-3 inline-block rounded-full bg-white/20 px-4 py-1 text-sm">
            Total: {list.data.meta.total} Employees
          </span>
        ) : null}
      </div>

      <Card>
        <Input
          type="search"
          placeholder="Search by name or employee code"
          aria-label="Search employees"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </Card>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to employees">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No employees found"
            description="Employees you are allowed to see will appear here."
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="All Employees Document List"
            rows={list.data.data}
            getRowKey={(e) => String(e.id)}
            columns={[
              {
                header: "Employee ID",
                cell: (e) => (
                  <span className="font-medium">{e.employeeCode}</span>
                ),
              },
              {
                header: "Name",
                cell: (e) => e.fullName,
              },
              { header: "Team", cell: (e) => e.team.name },
              { header: "Designation", cell: (e) => e.designation.name },
              { header: "Joining Date", cell: (e) => e.dateOfJoining },
              {
                header: "Actions",
                cell: (e) => (
                  <Link
                    href={`/hr/employee-documents/${e.id}`}
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    View documents
                  </Link>
                ),
              },
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
