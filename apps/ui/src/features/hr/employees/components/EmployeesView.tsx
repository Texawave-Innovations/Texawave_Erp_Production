"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Users,
  Download,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
  Edit,
  Eye,
  Upload,
  ClipboardCheck,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Alert,
  Button,
  Card,
  DataTable,
  DateRangePicker,
  EmptyState,
  ErrorState,
  FilterChips,
  Input,
  Pagination,
  SearchInput,
  Select,
  TableSkeleton,
  useToast,
  type FilterChipItem,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { exportEmployeesCsv, type EmployeeListQuery } from "../api";
import { useDebouncedValue, useEmployees, useLookup } from "../hooks";
import {
  EXPORT_ANY_SCOPE,
  ONBOARDING_APPROVE_TEAM_OR_ALL,
  READ_ANY_SCOPE,
  WRITE_TEAM_OR_ALL,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import type { EmployeeStatus, OnboardingReviewStatus } from "../types";
import { EMPLOYEE_STATUSES, ONBOARDING_REVIEW_STATUSES } from "../types";
import { EmployeeStatsRow } from "./EmployeeStatsRow";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";
import { ImportEmployeesDialog } from "./ImportEmployeesDialog";
import { OnboardingReviewBadge, REVIEW_LABELS } from "./OnboardingReviewBadge";
import { OnboardingStatusBadge } from "./OnboardingStatusBadge";
import { EmployeeIdentity, HrPageHeader } from "@/features/hr/components";

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
  reviewStatus: "" | OnboardingReviewStatus;
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
  reviewStatus: "",
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
  const canExport = usePermission(EXPORT_ANY_SCOPE);
  const canApprove = usePermission(ONBOARDING_APPROVE_TEAM_OR_ALL);
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    ...(filters.reviewStatus
      ? { onboardingReviewStatus: filters.reviewStatus }
      : {}),
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
    filters.reviewStatus,
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
  if (filters.reviewStatus) {
    activeChips.push({
      id: "review",
      label: "Review",
      value: REVIEW_LABELS[filters.reviewStatus],
      onRemove: () => update("reviewStatus", ""),
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

  /** Same filters as the table; the API narrows rows to the export scope. */
  async function handleExport() {
    setExporting(true);
    try {
      const { page: _p, limit: _l, ...filtersOnly } = query;
      await exportEmployeesCsv(filtersOnly);
    } catch (error) {
      toast({
        title: "Export failed",
        description:
          error instanceof Error ? error.message : "Try again in a moment.",
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  }

  const awaitingReview = filters.reviewStatus === "PENDING_REVIEW";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-12 animate-reveal">
      {/* Hero Banner */}
      <HrPageHeader
        title="Employees"
        description={
          list.data
            ? hasFilters
              ? `Showing ${list.data.meta.total} matching employees across all teams`
              : `${list.data.meta.total} registered workforce members across all departments`
            : "Manage workforce records, teams, designations, and account statuses"
        }
        icon={Users}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canExport ? (
              <Button
                variant="secondary"
                onClick={() => void handleExport()}
                loading={exporting}
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-4 py-2.5 font-medium"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="secondary"
                onClick={() => setImportOpen(true)}
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-4 py-2.5 font-medium"
              >
                <Upload className="h-4 w-4" />
                <span>Import CSV</span>
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="primary"
                onClick={() => router.push("/hr/employees/new")}
                className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shadow-xs rounded-xl px-4 py-2.5 font-medium border-0"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Employee</span>
              </Button>
            ) : null}
          </div>
        }
      />

      <EmployeeStatsRow />

      {/* Compact Filter Toolbar */}
      <div className="rounded-2xl border border-sky-100 bg-white p-3.5 shadow-xs transition-shadow duration-200 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Search Input */}
          <SearchInput
            placeholder="Search by name, code or work e-mail"
            aria-label="Search employees"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            onClear={() => update("search", "")}
            sizeVariant="sm"
            className="flex-1 sm:max-w-md"
          />

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

            {/* Quick filter: HR's onboarding review queue */}
            <Button
              type="button"
              variant={awaitingReview ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={awaitingReview}
              onClick={() =>
                update("reviewStatus", awaitingReview ? "" : "PENDING_REVIEW")
              }
              className="gap-1.5 h-9 px-3 text-theme-xs"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Awaiting review</span>
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

            {/* Export Button (Reference Image) */}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {}}
              className="gap-1.5 h-9 bg-linear-135 from-brand-600 to-brand-cyan text-white shadow-xs rounded-xl px-3.5 border-0 hover:opacity-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </Button>
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

              {/* Onboarding review */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                  Review
                </label>
                <Select
                  aria-label="Filter by onboarding review"
                  value={filters.reviewStatus}
                  onChange={(e) =>
                    update(
                      "reviewStatus",
                      e.target.value as "" | OnboardingReviewStatus,
                    )
                  }
                  className="h-8.5 text-theme-xs py-1"
                >
                  <option value="">All review states</option>
                  {ONBOARDING_REVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {REVIEW_LABELS[s]}
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
                  cell: (e) =>
                    e.onboardingReviewStatus === "NOT_SUBMITTED" ? (
                      <OnboardingStatusBadge status={e.onboardingStatus} />
                    ) : e.onboardingReviewStatus === "PENDING_REVIEW" ? (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/hr/employees/${e.id}/onboarding`)
                        }
                        aria-label={`Review submitted details of ${e.fullName}`}
                        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        <OnboardingReviewBadge
                          status={e.onboardingReviewStatus}
                        />
                      </button>
                    ) : (
                      <OnboardingReviewBadge
                        status={e.onboardingReviewStatus}
                      />
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
                            label:
                              canApprove &&
                              e.onboardingReviewStatus === "PENDING_REVIEW"
                                ? "Review onboarding"
                                : "Onboarding progress",
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

      {importOpen ? (
        <ImportEmployeesDialog open onClose={() => setImportOpen(false)} />
      ) : null}
    </div>
  );
}
