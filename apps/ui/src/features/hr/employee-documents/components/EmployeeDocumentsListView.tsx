"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FileText,
  FolderOpen,
  LayoutGrid,
  List,
  RotateCcw,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity, HrPageHeader } from "@/features/hr/components";
import {
  useDebouncedValue,
  useEmployees,
  useLookup,
} from "../../employees/hooks";
import { EmployeeStatusBadge } from "../../employees/components/EmployeeStatusBadge";
import {
  EMPLOYEE_STATUSES,
  type EmployeeStatus,
} from "../../employees/types";
import { STATUS_LABELS } from "../../employees/status";
import { READ_ANY_SCOPE } from "../../employees/permissions";
import { EmployeeDocumentEmployeeCard } from "./EmployeeDocumentEmployeeCard";

const PAGE_SIZE = 20;
const DOCUMENT_READ_SCOPE = [
  "hr.employee_document.read.own",
  "hr.employee_document.read.team",
  "hr.employee_document.read.all",
] as const;

/**
 * Directory of employee documents.
 * Features an Executive Directory Card Grid along with a Table View toggle,
 * instant search, and department/team filtering.
 */
export function EmployeeDocumentsListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [status, setStatus] = useState<"" | EmployeeStatus>("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const debouncedSearch = useDebouncedValue(search.trim());

  const canReadEmployees = usePermission(READ_ANY_SCOPE);
  const canReadDocuments = usePermission(DOCUMENT_READ_SCOPE);

  const departments = useLookup("/departments", canReadEmployees);

  const list = useEmployees({
    page,
    limit: PAGE_SIZE,
    sortBy: "fullName",
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(departmentId ? { departmentId: Number(departmentId) } : {}),
    ...(status ? { status } : {}),
  });

  const hasActiveFilters = Boolean(search || departmentId || status);

  const clearFilters = () => {
    setSearch("");
    setDepartmentId("");
    setStatus("");
    setPage(1);
  };

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
    <div className="flex flex-col gap-5">
      {/* Main Tab Header (Preserving standard HrPageHeader) */}
      <HrPageHeader
        title="Employee Documents"
        description="Upload and review onboarding, identity, and compliance documents for every team member."
        icon={FileText}
        badge={
          list.data ? (
            <span className="rounded-full bg-white/20 backdrop-blur-xs px-3.5 py-1.5 text-xs font-semibold text-white">
              Total: {list.data.meta.total} Employees
            </span>
          ) : null
        }
      />

      {/* Toolbar: Search, Filters & View Toggle */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="flex-1 min-w-60">
          <SearchInput
            placeholder="Search by name or employee code..."
            aria-label="Search employees"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearch("");
              setPage(1);
            }}
            clearable
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter */}
          <div className="w-40 sm:w-44">
            <Select
              aria-label="Filter by department"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              className="h-10 text-xs"
            >
              <option value="">All Departments</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-32 sm:w-36">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "" | EmployeeStatus);
                setPage(1);
              }}
              className="h-10 text-xs"
            >
              <option value="">All Statuses</option>
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              title="Clear all filters"
              className="h-10 gap-1.5 rounded-xl border border-rose-200/80 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          )}

          {/* View Mode Toggle: Grid Cards vs Table */}
          <div className="flex items-center rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-brand-500 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-brand-500 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {list.isPending ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-13 w-13 rounded-2xl" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
                <div className="mt-5">
                  <Skeleton className="h-9 w-full rounded-xl" />
                </div>
                <div className="mt-6">
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        )
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to employees">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-10 dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title={
              debouncedSearch || departmentId || status
                ? "No employees match the active filters"
                : "No employees found"
            }
            description={
              debouncedSearch || departmentId || status
                ? "Try clearing or modifying your search and filter criteria."
                : "Employees you are allowed to see will appear here."
            }
          />
        </div>
      ) : viewMode === "grid" ? (
        <>
          {/* Employee Documents Directory Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.data.data.map((employee) => (
              <EmployeeDocumentEmployeeCard
                key={employee.id}
                employee={employee}
              />
            ))}
          </div>

          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      ) : (
        <>
          {/* Table View Alternative with EmployeeIdentity and Direct Action */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <DataTable
              caption="All Employees Document List"
              rows={list.data.data}
              getRowKey={(e) => String(e.id)}
              columns={[
                {
                  header: "Employee",
                  cell: (e) => (
                    <EmployeeIdentity
                      name={e.fullName}
                      code={e.employeeCode}
                      href={`/hr/employee-documents/${e.id}`}
                    />
                  ),
                },
                {
                  header: "Department / Team",
                  cell: (e) => (
                    <span className="inline-block rounded-md border border-slate-200/60 bg-slate-100/70 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {e.team?.name || "—"}
                    </span>
                  ),
                },
                {
                  header: "Designation",
                  cell: (e) => (
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {e.designation?.name || "—"}
                    </span>
                  ),
                },
                {
                  header: "Joining Date",
                  cell: (e) => (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {e.dateOfJoining || "—"}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: (e) => <EmployeeStatusBadge status={e.status} />,
                },
                {
                  header: "Action",
                  cell: (e) => (
                    <Link
                      href={`/hr/employee-documents/${e.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-brand-500 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span>View Documents</span>
                    </Link>
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
        </>
      )}
    </div>
  );
}
