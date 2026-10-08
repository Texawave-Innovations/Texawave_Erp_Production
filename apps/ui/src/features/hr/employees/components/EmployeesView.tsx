"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import type { EmployeeListQuery } from "../api";
import { useDebouncedValue, useEmployees, useLookup } from "../hooks";
import { READ_ANY_SCOPE, WRITE_TEAM_OR_ALL } from "../permissions";
import { STATUS_LABELS } from "../status";
import type { EmployeeStatus } from "../types";
import { EMPLOYEE_STATUSES } from "../types";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";
import { OnboardingStatusBadge } from "./OnboardingStatusBadge";

const PAGE_SIZE = 20;

type SortBy = NonNullable<EmployeeListQuery["sortBy"]>;

const SORT_OPTIONS: ReadonlyArray<{ value: SortBy; label: string }> = [
  { value: "employeeCode", label: "Employee code" },
  { value: "fullName", label: "Name" },
  { value: "dateOfJoining", label: "Joining date" },
  { value: "status", label: "Status" },
  { value: "createdAt", label: "Recently added" },
];

interface Filters {
  search: string;
  status: "" | EmployeeStatus;
  departmentId: string;
  designationId: string;
  employmentTypeId: string;
  workLocationId: string;
  joinedFrom: string;
  joinedTo: string;
  sortBy: SortBy;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  status: "",
  departmentId: "",
  designationId: "",
  employmentTypeId: "",
  workLocationId: "",
  joinedFrom: "",
  joinedTo: "",
  sortBy: "employeeCode",
};

const num = (v: string) => (v ? Number(v) : undefined);

/**
 * Employee directory. Filtering, search, sorting and paging all happen on the
 * server; this view only builds the query. Phone, e-mail and exit reason are
 * not in the list payload by design, so they are not shown here.
 */
export function EmployeesView() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search.trim());

  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const departmentId = num(filters.departmentId);
  const designationId = num(filters.designationId);
  const employmentTypeId = num(filters.employmentTypeId);
  const workLocationId = num(filters.workLocationId);

  const query: EmployeeListQuery = {
    page,
    limit: PAGE_SIZE,
    sortBy: filters.sortBy,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(departmentId !== undefined ? { departmentId } : {}),
    ...(designationId !== undefined ? { designationId } : {}),
    ...(employmentTypeId !== undefined ? { employmentTypeId } : {}),
    ...(workLocationId !== undefined ? { workLocationId } : {}),
    ...(filters.joinedFrom ? { joinedFrom: filters.joinedFrom } : {}),
    ...(filters.joinedTo ? { joinedTo: filters.joinedTo } : {}),
  };

  const list = useEmployees(query);
  const departments = useLookup("/departments", canRead);
  const designations = useLookup("/master-data/designations", canRead);
  const employmentTypes = useLookup("/master-data/employment-types", canRead);
  const workLocations = useLookup("/master-data/work-locations", canRead);

  const hasFilters =
    filters.search.trim() !== "" ||
    filters.status !== "" ||
    filters.departmentId !== "" ||
    filters.designationId !== "" ||
    filters.employmentTypeId !== "" ||
    filters.workLocationId !== "" ||
    filters.joinedFrom !== "" ||
    filters.joinedTo !== "";

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to employees">
        Ask an administrator for the <code>hr.employee.read</code> permission.
      </Alert>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Employees
        </h1>
        {list.data ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {hasFilters
              ? `Showing ${list.data.meta.total} matching employees`
              : `${list.data.meta.total} employees`}
          </p>
        ) : null}
      </div>
      {canWrite ? (
        <Button onClick={() => router.push("/hr/employees/new")}>
          New employee
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            type="search"
            placeholder="Search by name, code or work e-mail"
            aria-label="Search employees"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
          />
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              update("status", e.target.value as "" | EmployeeStatus)
            }
          >
            <option value="">All statuses</option>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by department"
            value={filters.departmentId}
            onChange={(e) => update("departmentId", e.target.value)}
          >
            <option value="">All departments</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by designation"
            value={filters.designationId}
            onChange={(e) => update("designationId", e.target.value)}
          >
            <option value="">All designations</option>
            {(designations.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by employment type"
            value={filters.employmentTypeId}
            onChange={(e) => update("employmentTypeId", e.target.value)}
          >
            <option value="">All employment types</option>
            {(employmentTypes.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by work location"
            value={filters.workLocationId}
            onChange={(e) => update("workLocationId", e.target.value)}
          >
            <option value="">All work locations</option>
            {(workLocations.data ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              aria-label="Joined on or after"
              value={filters.joinedFrom}
              onChange={(e) => update("joinedFrom", e.target.value)}
            />
            <Input
              type="date"
              aria-label="Joined on or before"
              value={filters.joinedTo}
              onChange={(e) => update("joinedTo", e.target.value)}
            />
          </div>
          <Select
            aria-label="Sort by"
            value={filters.sortBy}
            onChange={(e) => update("sortBy", e.target.value as SortBy)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Sort: {o.label}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters ? (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
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
            title={
              hasFilters
                ? "No employees match these filters"
                : "No employees yet"
            }
            description={
              hasFilters
                ? "Try a different search or clear the filters."
                : canWrite
                  ? "Create the first employee to see them here."
                  : "Employees you are allowed to see will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Employees"
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
                    href={`/hr/employees/${e.id}`}
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {e.fullName}
                  </Link>
                ),
              },
              { header: "Team", cell: (e) => e.team.name },
              { header: "Designation", cell: (e) => e.designation.name },
              { header: "Employment type", cell: (e) => e.employmentType.name },
              { header: "Joined", cell: (e) => e.dateOfJoining },
              {
                header: "Status",
                cell: (e) => <EmployeeStatusBadge status={e.status} />,
              },
              {
                header: "Onboarding",
                cell: (e) => (
                  <OnboardingStatusBadge status={e.onboardingStatus} />
                ),
              },
              {
                header: "Login",
                cell: (e) => (e.hasLogin ? "Linked" : "—"),
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
