"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
  Edit,
  Eye,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DateRangePicker,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { ActionMenu } from "@/components/ActionMenu";
import type { EmployeeListQuery } from "../api";
import { useDebouncedValue, useEmployees, useLookup } from "../hooks";
import { READ_ANY_SCOPE, WRITE_TEAM_OR_ALL } from "../permissions";
import { STATUS_LABELS } from "../status";
import type { EmployeeStatus } from "../types";
import { EMPLOYEE_STATUSES } from "../types";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";
import { OnboardingStatusBadge } from "./OnboardingStatusBadge";
import {
  EmployeeIdentity,
  FilterChips,
  TableSkeleton,
  type FilterChipItem,
} from "@/features/hr/components";

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
 * Enhanced Employee Directory.
 * Conforms to TEXA HR Design System with compact filter bar, expandable filter panel,
 * active filter chips, EmployeeIdentity component, and ActionMenu row actions.
 */
export function EmployeesView() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
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

  // Active filter count (excluding default search/sort)
  const activeFilterCount = [
    filters.status,
    filters.departmentId,
    filters.designationId,
    filters.employmentTypeId,
    filters.workLocationId,
    filters.joinedFrom,
    filters.joinedTo,
  ].filter(Boolean).length;

  const hasFilters = filters.search.trim() !== "" || activeFilterCount > 0;

  // Build active filter chips
  const activeChips: FilterChipItem[] = [];
  if (filters.search.trim()) {
    activeChips.push({
      id: "search",
      label: "Search",
      value: filters.search.trim(),
      onRemove: () => update("search", ""),
    });
  }
  if (filters.status) {
    activeChips.push({
      id: "status",
      label: "Status",
      value: STATUS_LABELS[filters.status],
      onRemove: () => update("status", ""),
    });
  }
  if (filters.departmentId) {
    const dName =
      departments.data?.find((d) => String(d.id) === filters.departmentId)
        ?.name ?? filters.departmentId;
    activeChips.push({
      id: "department",
      label: "Department",
      value: dName,
      onRemove: () => update("departmentId", ""),
    });
  }
  if (filters.designationId) {
    const desName =
      designations.data?.find((d) => String(d.id) === filters.designationId)
        ?.name ?? filters.designationId;
    activeChips.push({
      id: "designation",
      label: "Designation",
      value: desName,
      onRemove: () => update("designationId", ""),
    });
  }
  if (filters.employmentTypeId) {
    const empName =
      employmentTypes.data?.find(
        (e) => String(e.id) === filters.employmentTypeId,
      )?.name ?? filters.employmentTypeId;
    activeChips.push({
      id: "employmentType",
      label: "Employment",
      value: empName,
      onRemove: () => update("employmentTypeId", ""),
    });
  }
  if (filters.workLocationId) {
    const locName =
      workLocations.data?.find((w) => String(w.id) === filters.workLocationId)
        ?.name ?? filters.workLocationId;
    activeChips.push({
      id: "workLocation",
      label: "Location",
      value: locName,
      onRemove: () => update("workLocationId", ""),
    });
  }
  if (filters.joinedFrom || filters.joinedTo) {
    const val = `${filters.joinedFrom || "Start"} to ${filters.joinedTo || "Now"}`;
    activeChips.push({
      id: "joined",
      label: "Joined",
      value: val,
      onRemove: () => {
        update("joinedFrom", "");
        update("joinedTo", "");
      },
    });
  }

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to employees">
        Ask an administrator for the <code>hr.employee.read</code> permission.
      </Alert>
    );
  }

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-12 animate-reveal">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-title-sm font-bold tracking-tight text-gray-900 dark:text-white">
              Employees
            </h1>
            {list.data && (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                {list.data.meta.total}
              </span>
            )}
          </div>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            {list.data
              ? hasFilters
                ? `Showing ${list.data.meta.total} matching employees across all teams`
                : `${list.data.meta.total} registered workforce members across all departments`
              : "Manage workforce records, teams, designations, and account statuses"}
          </p>
        </div>

        {canWrite && (
          <div className="shrink-0">
            <Button
              variant="primary"
              onClick={() => router.push("/hr/employees/new")}
              className="gap-2 shadow-theme-xs"
            >
              <UserPlus className="h-4 w-4" />
              <span>New employee</span>
            </Button>
          </div>
        )}
      </div>

      {/* Compact Filter Toolbar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-theme-xs transition-shadow duration-200 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 space-y-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Search Input */}
          <div className="relative flex-1 sm:max-w-md">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <Search className="h-4 w-4" />
            </span>
            <Input
              type="search"
              placeholder="Search by name, code or work e-mail"
              aria-label="Search employees"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
              className="w-full pl-9 pr-8 text-theme-xs h-9"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => update("search", "")}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right: Controls (Filters Toggle, Sort, Clear) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Toggle Button */}
            <Button
              type="button"
              variant={
                filtersExpanded || activeFilterCount > 0 ? "secondary" : "ghost"
              }
              size="sm"
              onClick={() => setFiltersExpanded((prev) => !prev)}
              className={`gap-1.5 h-9 px-3 text-theme-xs ${
                activeFilterCount > 0
                  ? "border-brand-300 text-brand-800 dark:border-brand-700 dark:text-brand-300"
                  : ""
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-brand-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-200 ${
                  filtersExpanded ? "rotate-180" : ""
                }`}
              />
            </Button>

            {/* Sort Option Select */}
            <div className="w-44">
              <Select
                aria-label="Sort by"
                value={filters.sortBy}
                onChange={(e) => update("sortBy", e.target.value as SortBy)}
                className="h-9 text-theme-xs py-1"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    Sort: {o.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Clear Filters (if active) */}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-9 text-theme-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Expandable Advanced Filter Panel */}
        {filtersExpanded && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* Status */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                  Status
                </label>
                <Select
                  aria-label="Filter by status"
                  value={filters.status}
                  onChange={(e) =>
                    update("status", e.target.value as "" | EmployeeStatus)
                  }
                  className="h-8.5 text-theme-xs py-1"
                >
                  <option value="">All statuses</option>
                  {EMPLOYEE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                  Department
                </label>
                <Select
                  aria-label="Filter by department"
                  value={filters.departmentId}
                  onChange={(e) => update("departmentId", e.target.value)}
                  className="h-8.5 text-theme-xs py-1"
                >
                  <option value="">All departments</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                  Designation
                </label>
                <Select
                  aria-label="Filter by designation"
                  value={filters.designationId}
                  onChange={(e) => update("designationId", e.target.value)}
                  className="h-8.5 text-theme-xs py-1"
                >
                  <option value="">All designations</option>
                  {(designations.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Employment Type */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                  Type
                </label>
                <Select
                  aria-label="Filter by employment type"
                  value={filters.employmentTypeId}
                  onChange={(e) => update("employmentTypeId", e.target.value)}
                  className="h-8.5 text-theme-xs py-1"
                >
                  <option value="">All employment types</option>
                  {(employmentTypes.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Work Location */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                  Location
                </label>
                <Select
                  aria-label="Filter by work location"
                  value={filters.workLocationId}
                  onChange={(e) => update("workLocationId", e.target.value)}
                  className="h-8.5 text-theme-xs py-1"
                >
                  <option value="">All work locations</option>
                  {(workLocations.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Joining Date Range */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                  Joined Date
                </label>
                <DateRangePicker
                  value={{ from: filters.joinedFrom, to: filters.joinedTo }}
                  onChange={(r) => {
                    setFilters((prev) => ({
                      ...prev,
                      joinedFrom: r.from,
                      joinedTo: r.to,
                    }));
                    setPage(1);
                  }}
                  onClear={() => {
                    setFilters((prev) => ({
                      ...prev,
                      joinedFrom: "",
                      joinedTo: "",
                    }));
                    setPage(1);
                  }}
                  fromAriaLabel="Joined on or after"
                  toAriaLabel="Joined on or before"
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Chips */}
        {activeChips.length > 0 && (
          <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800">
            <FilterChips chips={activeChips} onClearAll={clearAllFilters} />
          </div>
        )}
      </div>

      {/* Data Table Section */}
      {list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={9} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to employees">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
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
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearAllFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <DataTable
              caption="Employees"
              rows={list.data.data}
              getRowKey={(e) => String(e.id)}
              columns={[
                {
                  header: "Employee",
                  cell: (e) => (
                    <EmployeeIdentity
                      name={e.fullName}
                      code={e.employeeCode}
                      href={`/hr/employees/${e.id}`}
                    />
                  ),
                },
                {
                  header: "Team",
                  cell: (e) => (
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {e.team.name}
                    </span>
                  ),
                },
                {
                  header: "Designation",
                  cell: (e) => (
                    <span className="text-gray-600 dark:text-gray-300">
                      {e.designation.name}
                    </span>
                  ),
                },
                {
                  header: "Employment type",
                  cell: (e) => (
                    <span className="text-gray-600 dark:text-gray-300">
                      {e.employmentType.name}
                    </span>
                  ),
                },
                {
                  header: "Joined",
                  cell: (e) => (
                    <span className="font-mono text-[12px] text-gray-500 dark:text-gray-400">
                      {e.dateOfJoining}
                    </span>
                  ),
                },
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
                  cell: (e) => (
                    <span
                      className={`inline-flex items-center gap-1.5 text-theme-xs font-semibold ${
                        e.hasLogin
                          ? "text-success-700 dark:text-success-300"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {e.hasLogin ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                          Linked
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  ),
                },
                {
                  header: "Actions",
                  className: "text-right",
                  headerClassName: "text-right",
                  cell: (e) => (
                    <div className="flex justify-end">
                      <ActionMenu
                        ariaLabel={`Actions for ${e.fullName}`}
                        items={[
                          {
                            label: "View profile",
                            icon: <Eye className="h-3.5 w-3.5" />,
                            onClick: () => router.push(`/hr/employees/${e.id}`),
                          },
                          ...(canWrite
                            ? [
                                {
                                  label: "Edit employee",
                                  icon: <Edit className="h-3.5 w-3.5" />,
                                  onClick: () =>
                                    router.push(`/hr/employees/${e.id}/edit`),
                                },
                              ]
                            : []),
                          {
                            label: "Onboarding progress",
                            icon: <ExternalLink className="h-3.5 w-3.5" />,
                            onClick: () =>
                              router.push(`/hr/employees/${e.id}/onboarding`),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
