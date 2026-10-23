"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Plus,
  Search,
  User,
  X,
  XCircle,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DatePicker,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  EMPLOYEE_READ_ANY_SCOPE,
  type EmployeeOption,
  useEmployeeOptions,
} from "@/components/widgets/employee-picker.api";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { exportLeaveRequestsCsv } from "../api";
import { leaveErrorMessage } from "../errors";
import {
  useLeaveRequests,
  useLeaveStatusCounts,
  useLeaveTypes,
} from "../hooks";
import {
  APPROVE_ANY_SCOPE,
  CREATE_ON_BEHALF_SCOPE,
  EXPORT_ANY_SCOPE,
  HR_CANCEL_SCOPE,
  LEAVE_TYPE_READ,
} from "../permissions";
import { DAY_PORTION_LABELS } from "../status";
import type { LeaveRequestItem, LeaveStatus } from "../types";
import { ApplyOnBehalfDialog } from "./ApplyOnBehalfDialog";
import { DecideLeaveDialog } from "./DecideLeaveDialog";
import { HrCancelLeaveDialog } from "./HrCancelLeaveDialog";
import { LeaveStatusBadge } from "./LeaveStatusBadge";
import { appliedByOther } from "./cells";

const PAGE_SIZE = 10;
const thisMonth = () =>
  new Intl.DateTimeFormat("en-CA").format(new Date()).slice(0, 7);

function monthRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const parts = month.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

function shiftMonth(monthStr: string, delta: number): string {
  const parts = monthStr.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ny = d.getUTCFullYear();
  const nm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface StatusCardConfig {
  id: "" | LeaveStatus;
  label: string;
  icon: typeof FileText;
  borderStyle: string;
  bgGradient: string;
  countColor: string;
  iconContainerStyle: string;
}

const STATUS_CARDS: StatusCardConfig[] = [
  {
    id: "",
    label: "Total Requests",
    icon: FileText,
    borderStyle: "border-sky-200/80 dark:border-sky-900/40",
    bgGradient: "bg-gradient-to-r from-[#f0f9ff] to-[#e0f2fe] dark:from-slate-900 dark:to-slate-800",
    countColor: "text-sky-900 dark:text-white",
    iconContainerStyle: "border-sky-300/80 bg-white text-[#1769F5] dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300",
  },
  {
    id: "PENDING",
    label: "Pending",
    icon: Clock,
    borderStyle: "border-amber-200/80 dark:border-amber-900/40",
    bgGradient: "bg-gradient-to-r from-[#fffbeb] to-[#fef3c7] dark:from-slate-900 dark:to-slate-800",
    countColor: "text-amber-800 dark:text-amber-300",
    iconContainerStyle: "border-amber-300/80 bg-white text-amber-600 dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300",
  },
  {
    id: "APPROVED",
    label: "Approved",
    icon: CheckCircle2,
    borderStyle: "border-emerald-200/80 dark:border-emerald-900/40",
    bgGradient: "bg-gradient-to-r from-[#f0fdf4] to-[#ecfdf5] dark:from-slate-900 dark:to-slate-800",
    countColor: "text-emerald-800 dark:text-emerald-300",
    iconContainerStyle: "border-emerald-300/80 bg-white text-emerald-600 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300",
  },
  {
    id: "REJECTED",
    label: "Rejected",
    icon: XCircle,
    borderStyle: "border-rose-200/80 dark:border-rose-900/40",
    bgGradient: "bg-gradient-to-r from-[#fff1f2] to-[#ffe4e6] dark:from-slate-900 dark:to-slate-800",
    countColor: "text-rose-800 dark:text-rose-300",
    iconContainerStyle: "border-rose-300/80 bg-white text-rose-600 dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300",
  },
  {
    id: "CANCELLED",
    label: "Cancelled",
    icon: Ban,
    borderStyle: "border-slate-200/80 dark:border-slate-800",
    bgGradient: "bg-gradient-to-r from-slate-50 to-slate-100/70 dark:from-slate-900 dark:to-slate-800",
    countColor: "text-slate-800 dark:text-slate-300",
    iconContainerStyle: "border-slate-300/80 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
];

function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Clean, single-level searchable employee dropdown popover for the toolbar.
 * Eliminates stacked inputs and preserves clean h-10 alignment.
 */
function SearchableEmployeeDropdown({
  value,
  onChange,
}: {
  value: EmployeeOption | null;
  onChange: (e: EmployeeOption | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search.trim());
  const canRead = usePermission(EMPLOYEE_READ_ANY_SCOPE);
  const query = useEmployeeOptions(debounced, canRead);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const results = query.data?.data ?? [];
  const options =
    value && !results.some((e) => e.id === value.id)
      ? [value, ...results]
      : results;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-10 w-56 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition-all hover:border-slate-300 dark:border-slate-700 dark:bg-gray-800 dark:text-white cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-50 text-brand-500 dark:bg-sky-950/60 dark:text-sky-300">
            <User className="h-3 w-3" />
          </div>
          <span className="truncate">
            {value ? `${value.fullName} (${value.employeeCode})` : "All Employees"}
          </span>
        </div>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-sky-100/90 bg-white p-2.5 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search employee name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8.5 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-2.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                value === null
                  ? "bg-sky-50 text-brand-500 dark:bg-sky-950/50 dark:text-sky-300"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
              }`}
            >
              <span>All Employees</span>
              {value === null && <Check className="h-3.5 w-3.5" />}
            </button>

            {query.isPending ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading employees…</div>
            ) : options.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">No matching employees</div>
            ) : (
              options.map((opt) => {
                const isSelected = value?.id === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-sky-50 text-brand-500 font-bold dark:bg-sky-950/50 dark:text-sky-300"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {opt.fullName.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="truncate">{opt.fullName}</span>
                      <span className="text-[10px] text-slate-400">({opt.employeeCode})</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ApplicationsSection() {
  const canApprove = usePermission(APPROVE_ANY_SCOPE);
  const canCreate = usePermission(CREATE_ON_BEHALF_SCOPE);
  const canCancel = usePermission(HR_CANCEL_SCOPE);
  const canExport = usePermission(EXPORT_ANY_SCOPE);
  const canReadTypes = usePermission(LEAVE_TYPE_READ);
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | LeaveStatus>("");
  const [month, setMonth] = useState(thisMonth());
  const [leaveTypeId, setLeaveTypeId] = useState(0);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [exporting, setExporting] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [decision, setDecision] = useState<{
    request: LeaveRequestItem;
    decision: "approve" | "reject";
  } | null>(null);
  const [cancelling, setCancelling] = useState<LeaveRequestItem | null>(null);

  const range = monthRange(month);
  const filters = {
    ...(range ?? {}),
    ...(leaveTypeId ? { leaveTypeId } : {}),
    ...(employee ? { employeeId: employee.id } : {}),
  };
  const list = useLeaveRequests({
    page,
    limit: PAGE_SIZE,
    ...filters,
    ...(status ? { status } : {}),
  });
  const counts = useLeaveStatusCounts(filters);
  const types = useLeaveTypes({ page: 1, limit: 100 }, canReadTypes);
  const hasFilters = Boolean(
    status || leaveTypeId || employee || month !== thisMonth(),
  );

  function reset() {
    setStatus("");
    setMonth(thisMonth());
    setLeaveTypeId(0);
    setEmployee(null);
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportLeaveRequestsCsv({
        ...filters,
        ...(status ? { status } : {}),
      });
    } catch (err) {
      toast({
        title: "Could not export",
        description: leaveErrorMessage(
          err,
          "You don't have permission to export leave.",
        ),
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 5 Executive Status Presence Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_CARDS.map((c) => {
          const value =
            counts.data === undefined
              ? "…"
              : c.id === ""
                ? counts.data.total
                : counts.data[c.id];
          const selected = status === c.id;
          const Icon = c.icon;

          return (
            <button
              key={c.label}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setStatus(c.id);
                setPage(1);
              }}
              className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer shadow-xs ${
                c.borderStyle
              } ${c.bgGradient} ${
                selected ? "ring-2 ring-[#1769F5] shadow-xs scale-[1.02]" : "hover:shadow-xs"
              }`}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {c.label}
                </p>
                <h3 className={`mt-1 text-2xl font-extrabold ${c.countColor}`}>
                  {value}
                </h3>
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-2xs ${c.iconContainerStyle}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Executive Control Toolbar */}
      <div className="relative z-20 focus-within:z-30 rounded-2xl border border-sky-100/90 bg-white/95 p-4 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
        <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
          {/* Left: Month Navigator & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Navigator */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Previous month"
                onClick={() => {
                  setMonth((m) => shiftMonth(m, -1));
                  setPage(1);
                }}
                className="h-10 w-10 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="relative min-w-47.5">
                <DatePicker
                  mode="month"
                  value={month}
                  onChangeDate={(newVal) => {
                    if (newVal) {
                      setMonth(newVal);
                      setPage(1);
                    }
                  }}
                  clearable={false}
                  sizeVariant="md"
                  className="w-full"
                  inputClassName="font-bold text-slate-800 dark:text-white"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Next month"
                onClick={() => {
                  setMonth((m) => shiftMonth(m, 1));
                  setPage(1);
                }}
                className="h-10 w-10 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Leave Type Select */}
            {canReadTypes ? (
              <div className="w-48">
                <Select
                  aria-label="Leave type"
                  value={leaveTypeId || ""}
                  onChange={(e) => {
                    setLeaveTypeId(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value="">All leave types</option>
                  {(types.data?.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {/* Searchable Employee Dropdown */}
            <SearchableEmployeeDropdown
              value={employee}
              onChange={(e) => {
                setEmployee(e);
                setPage(1);
              }}
            />

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>

          {/* Right: Actions (Export CSV, Apply) */}
          <div className="flex flex-wrap items-center gap-2">
            {canExport ? (
              <Button
                variant="secondary"
                loading={exporting}
                onClick={() => void handleExport()}
                className="gap-2 text-xs"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </Button>
            ) : null}
            {canCreate ? (
              <Button onClick={() => setApplyOpen(true)} className="gap-2 text-xs">
                <Plus className="h-4 w-4" />
                <span>Apply for an employee</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      {list.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={8} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to leave requests"
          >
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-8 text-center shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
          <EmptyState
            title={
              hasFilters
                ? "No requests match these filters"
                : "No leave requests this month"
            }
            description="Try choosing another month, status, or employee."
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={reset}>
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        /* Reference-Matching Applications Table */
        <div className="flex flex-col gap-4">
          <DataTable
            caption="Leave applications"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "ID",
                cell: (r) => (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-brand-500 border border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
                    #LV-{String(r.id).padStart(4, "0")}
                  </span>
                ),
              },
              {
                header: "Employee",
                cell: (r) => (
                  <EmployeeIdentity
                    name={r.employee.fullName}
                    code={r.employee.employeeCode}
                    size="sm"
                  />
                ),
              },
              {
                header: "Leave Type",
                cell: (r) => (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {r.leaveType.name}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {r.leaveType.code}
                    </span>
                  </div>
                ),
              },
              {
                header: "From",
                cell: (r) => (
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatDisplayDate(r.startDate)}
                  </span>
                ),
              },
              {
                header: "To",
                cell: (r) => (
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatDisplayDate(r.endDate)}
                  </span>
                ),
              },
              {
                header: "Days",
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 w-fit">
                      {r.leaveDays} {r.leaveDays === 1 ? "day" : "days"}
                    </span>
                    {r.dayPortion !== "FULL" && (
                      <span className="text-[10px] text-brand-600 dark:text-cyan-400 font-semibold mt-0.5">
                        {DAY_PORTION_LABELS[r.dayPortion]}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                header: "Reason",
                cell: (r) => (
                  <p
                    className="max-w-56 truncate text-xs text-gray-600 dark:text-gray-300"
                    title={r.reason}
                  >
                    {r.reason}
                  </p>
                ),
              },
              {
                header: "Status",
                cell: (r) => (
                  <div className="flex flex-col gap-0.5">
                    <LeaveStatusBadge status={r.status} awaiting={r.awaiting} />
                    {appliedByOther(r) ? (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        By {appliedByOther(r)}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              ...(canApprove || canCancel
                ? [
                    {
                      header: "Actions",
                      className: "text-right",
                      cell: (r: LeaveRequestItem) => (
                        <div className="flex items-center justify-end gap-1.5">
                          {canApprove && r.status === "PENDING" ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setDecision({
                                    request: r,
                                    decision: "approve",
                                  })
                                }
                                className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  setDecision({
                                    request: r,
                                    decision: "reject",
                                  })
                                }
                                className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                          {canCancel &&
                          (r.status === "PENDING" ||
                            r.status === "APPROVED") ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setCancelling(r)}
                              className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Dialogs */}
      {applyOpen ? (
        <ApplyOnBehalfDialog
          open
          onClose={() => setApplyOpen(false)}
        />
      ) : null}

      {decision ? (
        <DecideLeaveDialog
          open
          onClose={() => setDecision(null)}
          request={decision.request}
          decision={decision.decision}
        />
      ) : null}

      {cancelling ? (
        <HrCancelLeaveDialog
          open
          onClose={() => setCancelling(null)}
          request={cancelling}
        />
      ) : null}
    </div>
  );
}
