"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Contact, Users } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { HrPageHeader } from "@/features/hr/components";
import { useDebouncedValue, useEmployees } from "@/features/hr/employees/hooks";
import { EmployeeStatusBadge } from "@/features/hr/employees/components/EmployeeStatusBadge";
import { PROFILE_READ_ANY_SCOPE } from "../permissions";

const PAGE_SIZE = 20;

/**
 * Directory of employee profiles. There is no separate profiles dataset —
 * profiles are per-employee — so this reuses the employee list query but
 * links each row to its profile screen rather than the employee record.
 */
export function ProfilesListView() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());

  const canRead = usePermission(PROFILE_READ_ANY_SCOPE);

  const list = useEmployees({
    page,
    limit: PAGE_SIZE,
    sortBy: "fullName",
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to profiles">
        Ask an administrator for the <code>hr.employee_profile.read</code>{" "}
        permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <HrPageHeader
        title="Profiles"
        description="Detailed employee career records, qualifications, and personal profiles."
        icon={Contact}
        badge={
          list.data ? (
            <span className="rounded-full bg-white/20 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-white">
              {list.data.meta.total} employees
            </span>
          ) : null
        }
        action={
          <Button
            variant="secondary"
            onClick={() => router.push("/hr/employees")}
            className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-4 py-2.5 font-medium"
          >
            <Users className="h-4 w-4 text-white" />
            <span>Employee Directory</span>
          </Button>
        }
      />

      <Card>
        <Input
          type="search"
          placeholder="Search by name, code or work e-mail"
          aria-label="Search profiles"
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
          <Alert variant="warning" title="You don't have access to profiles">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={
              debouncedSearch
                ? "No employees match this search"
                : "No employee profiles yet"
            }
            description={
              debouncedSearch
                ? "Try a different search."
                : "Profiles appear here once employees are added."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Profiles"
            rows={list.data.data}
            getRowKey={(e) => String(e.id)}
            columns={[
              {
                header: "Code",
                cell: (e) => (
                  <span className="font-medium">{e.employeeCode}</span>
                ),
              },
              {
                header: "Name",
                cell: (e) => (
                  <Link
                    href={`/hr/employees/${e.id}/profile`}
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {e.fullName}
                  </Link>
                ),
              },
              { header: "Team", cell: (e) => e.team.name },
              { header: "Designation", cell: (e) => e.designation.name },
              {
                header: "Status",
                cell: (e) => <EmployeeStatusBadge status={e.status} />,
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
