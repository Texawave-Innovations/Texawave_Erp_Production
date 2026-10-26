"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  X,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
  Edit,
  Eye,
  ClipboardCheck,
  RotateCcw,
  Link2,
  Unlink,
  Trash2,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DateRangePicker,
  EmptyState,
  ErrorState,
  FilterChips,
  Pagination,
  SearchInput,
  Select,
  Semantic3DIcon,
  TableSkeleton,
  useToast,
  cn,
  type FilterChipItem,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { exportEmployeesCsv, type EmployeeListQuery } from "../api";
import {
  useChangeEmployeeStatus,
  useDebouncedValue,
  useDeleteEmployee,
  useEmployees,
  useEmployeeStats,
  useLookup,
  useUnlinkEmployeeUser,
} from "../hooks";
import {
  ACCOUNT_WRITE,
  DELETE_EMPLOYEE,
  EXPORT_ANY_SCOPE,
  ONBOARDING_APPROVE_TEAM_OR_ALL,
  READ_ANY_SCOPE,
  STATUS_WRITE,
  WRITE_TEAM_OR_ALL,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import type {
  EmployeeListItem,
  EmployeeStatus,
  OnboardingReviewStatus,
} from "../types";
import { EMPLOYEE_STATUSES, ONBOARDING_REVIEW_STATUSES } from "../types";
import { EmployeeStatsRow } from "./EmployeeStatsRow";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";
import { ImportEmployeesDialog } from "./ImportEmployeesDialog";
import { LinkAccountDialog } from "./LinkAccountDialog";
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
  const canWriteStatus = usePermission(STATUS_WRITE);
  const canAccount = usePermission(ACCOUNT_WRITE);
  const canExport = usePermission(EXPORT_ANY_SCOPE);
  const canApprove = usePermission(ONBOARDING_APPROVE_TEAM_OR_ALL);
  const canDelete = usePermission(DELETE_EMPLOYEE);
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [updatingEmployeeId, setUpdatingEmployeeId] = useState<number | null>(
    null,
  );
  const [unlinkingEmployeeId, setUnlinkingEmployeeId] = useState<number | null>(
    null,
  );
  const [linkDialogOpen, setLinkDialogOpen] = useState<EmployeeListItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListItem | null>(
    null,
  );
  const changeStatusMutation = useChangeEmployeeStatus();
  const unlinkMutation = useUnlinkEmployeeUser();
  const deleteMutation = useDeleteEmployee();
  const stats = useEmployeeStats(canRead);
  const pendingReviewCount = stats.data?.onboarding.pendingReview ?? 0;

  const handleToggleLogin = async (
    e: React.MouseEvent,
    emp: EmployeeListItem,
  ) => {
    e.stopPropagation();
    if (!canAccount && !canWrite) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to manage employee accounts.",
        variant: "error",
      });
      return;
    }

    if (emp.hasLogin) {
      setUnlinkingEmployeeId(emp.id);
      try {
        await unlinkMutation.mutateAsync({
          id: emp.id,
          body: { reason: "Unlinked via employee directory quick action" },
        });
        toast({
          title: "Account unlinked",
          description: `${emp.fullName}'s login has been detached.`,
          variant: "success",
        });
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to unlink employee account";
        toast({
          title: "Unlink failed",
          description: message,
          variant: "error",
        });
      } finally {
        setUnlinkingEmployeeId(null);
      }
    } else {
      setLinkDialogOpen(emp);
    }
  };

  const handleToggleStatus = async (
    e: React.MouseEvent,
    emp: EmployeeListItem,
  ) => {
    e.stopPropagation();
    if (!canWriteStatus && !canWrite) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to update employee status.",
        variant: "error",
      });
      return;
    }

    if (emp.status !== "ACTIVE" && emp.status !== "INACTIVE") {
      router.push(`/hr/employees/${emp.id}`);
      return;
    }

    const nextStatus: EmployeeStatus =
      emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const today = new Intl.DateTimeFormat("en-CA").format(new Date());

    setUpdatingEmployeeId(emp.id);
    try {
      await changeStatusMutation.mutateAsync({
        id: emp.id,
        correction: false,
        body: {
          status: nextStatus,
          effectiveDate: today,
          reason: `Status changed to ${nextStatus === "ACTIVE" ? "Active" : "Inactive"} via employee directory quick action`,
        },
      });
      toast({
        title: `Status changed to ${STATUS_LABELS[nextStatus]}`,
        description: `${emp.fullName} is now ${STATUS_LABELS[nextStatus].toLowerCase()}.`,
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update employee status";
      toast({
        title: "Status change failed",
        description: message,
        variant: "error",
      });
    } finally {
      setUpdatingEmployeeId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({
        title: "Employee deleted",
        description: `${deleteTarget.fullName}'s record has been permanently removed.`,
        variant: "success",
      });
      setDeleteTarget(null);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to delete employee";
      toast({ title: "Delete failed", description: message, variant: "error" });
    }
  };

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
      toast({
        title: "Export complete",
        description: "The employees CSV has been downloaded successfully.",
        variant: "success",
      });
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
                <Semantic3DIcon name="export" size={18} />
                <span>Export CSV</span>
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="secondary"
                onClick={() => setImportOpen(true)}
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-4 py-2.5 font-medium"
              >
                <Semantic3DIcon name="import" size={18} />
                <span>Import CSV</span>
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="primary"
                onClick={() => router.push("/hr/employees/new")}
                className="gap-2"
              >
                <Semantic3DIcon name="plus" size={18} />
                <span>Add Employee</span>
              </Button>
            ) : null}
          </div>
        }
      />

      <EmployeeStatsRow />

      {/* Enhanced Filter Toolbar & Directory Controls */}
      <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-4 shadow-[0_4px_24px_-4px_rgba(14,165,233,0.08)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 transition-all space-y-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Universal Search Input */}
          <SearchInput
            placeholder="Search by name, code or work e-mail..."
            aria-label="Search employees"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            onClear={() => update("search", "")}
            sizeVariant="sm"
            className="flex-1 lg:max-w-md xl:max-w-lg"
          />

          {/* Right: Controls (Filters Toggle, Clear, Quick Review, Sort, Export) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick filter: HR's onboarding review queue */}
            <Button
              type="button"
              variant={awaitingReview ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={awaitingReview}
              onClick={() =>
                update("reviewStatus", awaitingReview ? "" : "PENDING_REVIEW")
              }
              className="gap-1.5 h-9 px-3 text-theme-xs cursor-pointer font-medium"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Awaiting review</span>
              {pendingReviewCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                  {pendingReviewCount}
                </span>
              )}
            </Button>

            {/* Filter Toggle Button */}
            <Button
              type="button"
              variant={
                filtersExpanded || activeFilterCount > 0 ? "secondary" : "ghost"
              }
              size="sm"
              onClick={() => setFiltersExpanded((prev) => !prev)}
              className={`gap-1.5 h-9 px-3 text-theme-xs cursor-pointer font-medium ${
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

            {/* Sudden-visible Clear Filters Button (Instantly visible in primary bar whenever any filter or search is active) */}
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                title="Clear all active search and filters"
                className="gap-1.5 h-9 px-2.5 text-theme-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear filters</span>
              </Button>
            )}

            {/* Sort Option Select */}
            <div className="w-40 sm:w-44">
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
          </div>
        </div>

        {/* Active Filter Chips Strip (Prominently visible below search bar) */}
        {activeChips.length > 0 && (
          <div className="pt-3 border-t border-sky-100/70 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
            <FilterChips
              chips={activeChips}
              onClearAll={clearAllFilters}
              clearAllLabel="Clear all"
              size="md"
            />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {list.data
                ? `${list.data.meta.total} ${
                    list.data.meta.total === 1 ? "employee" : "employees"
                  } found`
                : ""}
            </span>
          </div>
        )}

        {/* Expandable Advanced Filter Panel */}
        {filtersExpanded && (
          <div className="rounded-xl border border-sky-100/90 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-850/60 animate-in fade-in slide-in-from-top-1 duration-150 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-sky-100/80 dark:border-slate-800">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Advanced Filters
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Filter workforce by status, department, designation,
                  employment type, or dates
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset all</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFiltersExpanded(false)}
                  aria-label="Close filters panel"
                  className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

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
          <div className="rounded-2xl">
            <DataTable
              caption="Employees"
              tableClassName="w-full text-left text-theme-xs"
              density="compact"
              className="overflow-x-auto lg:overflow-x-visible scrollbar-none [&::-webkit-scrollbar]:hidden"
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
                      size="sm"
                    />
                  ),
                },
                {
                  header: "Team",
                  align: "center",
                  cell: (e) => (
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {e.team.name}
                    </span>
                  ),
                },
                {
                  header: "Designation",
                  align: "center",
                  cell: (e) => (
                    <span className="text-gray-600 dark:text-gray-300">
                      {e.designation.name}
                    </span>
                  ),
                },
                {
                  header: "Employment type",
                  align: "center",
                  cell: (e) => (
                    <span className="text-gray-600 dark:text-gray-300">
                      {e.employmentType.name}
                    </span>
                  ),
                },
                {
                  header: "Joined",
                  align: "center",
                  width: 95,
                  className: "w-[95px] text-center whitespace-nowrap",
                  headerClassName: "w-[95px] text-center whitespace-nowrap",
                  cell: (e) => (
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">
                      {e.dateOfJoining}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  align: "center",
                  width: 92,
                  className: "w-[92px] text-center whitespace-nowrap",
                  headerClassName: "w-[92px] text-center whitespace-nowrap",
                  cell: (e) => {
                    const isUpdating = updatingEmployeeId === e.id;
                    if (e.status === "ACTIVE" || e.status === "INACTIVE") {
                      const isActive = e.status === "ACTIVE";
                      return (
                        <div className="flex items-center justify-center">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(ev) => handleToggleStatus(ev, e)}
                            disabled={isUpdating}
                            aria-label={`${isActive ? "Active" : "Inactive"} status for ${e.fullName}. Click to toggle.`}
                            title={`Click to set ${isActive ? "Inactive" : "Active"}`}
                            className="w-20.5 min-w-20.5 max-w-20.5 h-7 px-1.5 text-xs font-semibold justify-center shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                          >
                            {isUpdating ? (
                              <span className="inline-flex items-center justify-center">
                                <svg
                                  className="h-3.5 w-3.5 animate-spin text-white"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                  />
                                </svg>
                              </span>
                            ) : (
                              <>
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full shrink-0",
                                    isActive
                                      ? "bg-emerald-300 ring-2 ring-emerald-400/40"
                                      : "bg-red-400 ring-2 ring-red-300/60",
                                  )}
                                />
                                <span>{isActive ? "Active" : "Inactive"}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center justify-center">
                        <EmployeeStatusBadge status={e.status} />
                      </div>
                    );
                  },
                },
                {
                  header: "Onboarding",
                  align: "center",
                  width: 120,
                  className: "w-[120px] text-center whitespace-nowrap",
                  headerClassName: "w-[120px] text-center whitespace-nowrap",
                  cell: (e) => (
                    <div className="flex items-center justify-center">
                      {e.onboardingReviewStatus === "NOT_SUBMITTED" ? (
                        <OnboardingStatusBadge status={e.onboardingStatus} />
                      ) : e.onboardingReviewStatus === "PENDING_REVIEW" ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/hr/employees/${e.id}/onboarding`)
                          }
                          aria-label={`Review submitted details of ${e.fullName}`}
                          className="rounded-full inline-flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        >
                          <OnboardingReviewBadge
                            status={e.onboardingReviewStatus}
                          />
                        </button>
                      ) : (
                        <OnboardingReviewBadge
                          status={e.onboardingReviewStatus}
                        />
                      )}
                    </div>
                  ),
                },
                {
                  header: "Login",
                  align: "center",
                  width: 92,
                  className: "w-[92px] text-center whitespace-nowrap",
                  headerClassName: "w-[92px] text-center whitespace-nowrap",
                  cell: (e) => {
                    const isUnlinking = unlinkingEmployeeId === e.id;
                    const isLinked = e.hasLogin;
                    return (
                      <div className="flex items-center justify-center">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(ev) => handleToggleLogin(ev, e)}
                          disabled={isUnlinking}
                          aria-label={`${isLinked ? "Linked" : "Unlinked"} account for ${e.fullName}. Click to ${isLinked ? "unlink" : "link"}.`}
                          title={
                            isLinked
                              ? "Click to unlink login account"
                              : "Click to link a platform login account"
                          }
                          className="w-20.5 min-w-20.5 max-w-20.5 h-7 px-1.5 text-xs font-semibold justify-center shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                        >
                          {isUnlinking ? (
                            <span className="inline-flex items-center justify-center">
                              <svg
                                className="h-3.5 w-3.5 animate-spin text-white"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                            </span>
                          ) : (
                            <>
                              {isLinked ? (
                                <Link2 className="h-3.5 w-3.5 shrink-0 text-white" />
                              ) : (
                                <Unlink className="h-3.5 w-3.5 shrink-0 text-white" />
                              )}
                              <span>{isLinked ? "Linked" : "Unlinked"}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  },
                },
                {
                  header: "Actions",
                  align: "center",
                  width: 60,
                  className: "w-[60px] text-center whitespace-nowrap",
                  headerClassName: "w-[60px] text-center whitespace-nowrap",
                  cell: (e) => (
                    <div className="flex items-center justify-center">
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
                          ...(canDelete
                            ? [
                                {
                                  label: "Delete employee",
                                  icon: <Trash2 className="h-3.5 w-3.5" />,
                                  variant: "destructive" as const,
                                  onClick: () => setDeleteTarget(e),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {deleteTarget ? (
            <ConfirmDialog
              open
              onClose={() => setDeleteTarget(null)}
              onConfirm={handleDelete}
              title="Delete employee?"
              description="This permanently removes the employee record. It only succeeds if they have no linked attendance, payroll, task, or similar records — if they do, deactivate them instead from the Status column."
              itemName={deleteTarget.fullName}
              loading={deleteMutation.isPending}
            />
          ) : null}

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

      {linkDialogOpen ? (
        <LinkAccountDialog
          open={Boolean(linkDialogOpen)}
          onClose={() => setLinkDialogOpen(null)}
          employee={linkDialogOpen}
          mode="link"
        />
      ) : null}
    </div>
  );
}
