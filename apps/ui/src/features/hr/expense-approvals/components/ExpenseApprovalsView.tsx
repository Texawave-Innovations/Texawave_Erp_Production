"use client";

import { useMemo, useState } from "react";
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
} from "@texawave-erp/ui-kit";
import {
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { useEmployees } from "@/features/hr/employees/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useExpenseClaims, useMyExpenseClaims } from "../hooks";
import {
  DECIDE_ANY_SCOPE,
  READ_ANY_SCOPE,
  SELF_SERVICE_CREATE,
  SELF_SERVICE_READ,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import {
  EXPENSE_CLAIM_STATUSES,
  EXPENSE_TYPES,
  type ExpenseClaimItem,
  type ExpenseClaimStatus,
  type ExpenseType,
} from "../types";
import { DecideExpenseClaimDialog } from "./DecideExpenseClaimDialog";
import { ExpenseClaimDetailsDialog } from "./ExpenseClaimDetailsDialog";
import { ExpenseClaimStatusBadge } from "./ExpenseClaimStatusBadge";
import { SubmitExpenseClaimDialog } from "./SubmitExpenseClaimDialog";

const PAGE_SIZE = 10;

type TabKey = "mine" | "team";

interface Filters {
  status: "" | ExpenseClaimStatus;
  expenseType: "" | ExpenseType;
  search: string;
}

const EMPTY_FILTERS: Filters = { status: "", expenseType: "", search: "" };

type DecisionState = {
  claim: ExpenseClaimItem;
  decision: "APPROVED" | "REJECTED";
} | null;

function formatIndianCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹ ${amount.toFixed(2)}`;
  }
}

function formatExpenseDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(
      dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00Z`,
    );
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

interface TableClaimItem extends ExpenseClaimItem {
  rowNumber: number;
}

/**
 * Enhanced Enterprise Expense Approvals View
 * Supports Personal Claims (Self-Service) & Team/Organization Approvals.
 */
export function ExpenseApprovalsView() {
  const hasSelfServiceRead = usePermission(SELF_SERVICE_READ);
  const hasSelfServiceCreate = usePermission(SELF_SERVICE_CREATE);
  const canReadAny = usePermission(READ_ANY_SCOPE);
  const canDecide = usePermission(DECIDE_ANY_SCOPE);

  const [requestedTab, setActiveTab] = useState<TabKey>(
    hasSelfServiceRead ? "mine" : "team",
  );
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  // Modal dialog states
  const [submitOpen, setSubmitOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<ExpenseClaimItem | null>(
    null,
  );
  const [decision, setDecision] = useState<DecisionState>(null);

  // Load employees for code lookup
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const employeeOptions = employeesQuery.data?.data ?? [];
  const employeeCodeMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const emp of employeeOptions) {
      map.set(emp.id, emp.employeeCode);
    }
    return map;
  }, [employeeOptions]);

  // Overview queries for accurate metric card calculation
  const myOverview = useMyExpenseClaims({ page: 1, limit: 100 });
  const teamOverview = useExpenseClaims({ page: 1, limit: 100 }, canReadAny);

  // The self-service permission only means the account holds
  // employee_self_service.expense_claim.read, not that it's actually linked to
  // an employee — an admin/HR account can hold it without being an employee
  // itself, and "my expense claims" is structurally empty for them, not
  // broken. Hide the "mine" tab rather than show a request failure that will
  // never resolve by retrying.
  const notAnEmployee =
    myOverview.isError &&
    myOverview.error instanceof ApiError &&
    myOverview.error.errorCode === "NOT_AN_EMPLOYEE";
  const canReadMine = hasSelfServiceRead && !notAnEmployee;
  const canCreateMine = hasSelfServiceCreate && !notAnEmployee;
  const activeTab: TabKey =
    requestedTab === "mine" && !canReadMine && canReadAny
      ? "team"
      : requestedTab;

  const myClaimsAll = myOverview.data?.data ?? [];
  const teamClaimsAll = teamOverview.data?.data ?? [];

  // Summary Metrics calculations
  const myMetrics = useMemo(() => {
    const total = myOverview.data?.meta.total ?? myClaimsAll.length;
    const approved = myClaimsAll.filter((c) => c.status === "APPROVED").length;
    const pending = myClaimsAll.filter((c) => c.status === "PENDING").length;
    const rejected = myClaimsAll.filter((c) => c.status === "REJECTED").length;
    return { total, approved, pending, rejected };
  }, [myOverview.data?.meta.total, myClaimsAll]);

  const teamMetrics = useMemo(() => {
    const total = teamOverview.data?.meta.total ?? teamClaimsAll.length;
    const pending = teamClaimsAll.filter((c) => c.status === "PENDING").length;
    const approved = teamClaimsAll.filter(
      (c) => c.status === "APPROVED",
    ).length;
    const rejected = teamClaimsAll.filter(
      (c) => c.status === "REJECTED",
    ).length;
    return { total, pending, approved, rejected };
  }, [teamOverview.data?.meta.total, teamClaimsAll]);

  // Query for current tab
  const activeQuery = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.expenseType ? { expenseType: filters.expenseType } : {}),
    }),
    [page, filters.status, filters.expenseType],
  );

  const myList = useMyExpenseClaims(activeQuery);
  const teamList = useExpenseClaims(activeQuery, canReadAny);

  const currentList = activeTab === "mine" ? myList : teamList;

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const hasFilters =
    filters.status !== "" ||
    filters.expenseType !== "" ||
    filters.search !== "";

  // Filtered rows for client search
  const displayedRows: TableClaimItem[] = useMemo(() => {
    const rawItems = currentList.data?.data ?? [];
    let items = rawItems;

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.expenseType.toLowerCase().includes(q) ||
          (activeTab === "team" &&
            r.employee.fullName.toLowerCase().includes(q)),
      );
    }

    return items.map((r, idx) => ({
      ...r,
      rowNumber: (page - 1) * PAGE_SIZE + idx + 1,
    }));
  }, [currentList.data?.data, filters.search, activeTab, page]);

  const totalRecords = currentList.data?.meta.total ?? displayedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  if (!canReadMine && !canReadAny) {
    return (
      <Alert variant="warning" title="You don't have access to expense claims">
        Ask an administrator for the{" "}
        <code>employee_self_service.expense_claim.read</code> or{" "}
        <code>hr.expense_claim.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Home</span>
            <span>/</span>
            <span>HR</span>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-200 font-medium">
              Expense Approvals
            </span>
          </div>
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white/90">
            Expense Approvals
          </h1>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Submit personal claims and review expense claims you are authorized
            to access.
          </p>
        </div>

        {canCreateMine ? (
          <Button
            size="sm"
            onClick={() => setSubmitOpen(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white font-medium inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Submit Expense Claim
          </Button>
        ) : null}
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {canReadMine ? (
          <button
            type="button"
            onClick={() => {
              setActiveTab("mine");
              setPage(1);
            }}
            className={`border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
              activeTab === "mine"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            My Expense Claims
          </button>
        ) : null}

        {canReadAny ? (
          <button
            type="button"
            onClick={() => {
              setActiveTab("team");
              setPage(1);
            }}
            className={`border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "team"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Team / Organization Claims
            {teamMetrics.pending > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-warning-100 px-1.5 py-0.5 text-[10px] font-semibold text-warning-800 dark:bg-warning-950/60 dark:text-warning-300">
                {teamMetrics.pending}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {/* 3. Summary Metric Cards */}
      {activeTab === "mine" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Total Claims */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {myMetrics.total}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Total Claims
              </p>
            </div>
          </div>

          {/* Approved */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-950/50 dark:text-success-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {myMetrics.approved}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Approved
              </p>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-950/50 dark:text-warning-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {myMetrics.pending}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Pending
              </p>
            </div>
          </div>

          {/* Rejected */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-error-50 text-error-600 dark:bg-error-950/50 dark:text-error-400">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {myMetrics.rejected}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Rejected
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Total Claims */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {teamMetrics.total}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Total Claims
              </p>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-950/50 dark:text-warning-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {teamMetrics.pending}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Pending
              </p>
            </div>
          </div>

          {/* Approved */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-950/50 dark:text-success-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {teamMetrics.approved}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Approved
              </p>
            </div>
          </div>

          {/* Rejected */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-error-50 text-error-600 dark:bg-error-950/50 dark:text-error-400">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {teamMetrics.rejected}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Rejected
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter Toolbar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={
                activeTab === "mine"
                  ? "Search by description or type..."
                  : "Search employee or description..."
              }
              aria-label={
                activeTab === "mine" ? "Search my claims" : "Search claims"
              }
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
              className="pl-9.5"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <Select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) =>
                update("status", e.target.value as "" | ExpenseClaimStatus)
              }
            >
              <option value="">All statuses</option>
              {EXPENSE_CLAIM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>

          {/* Expense Type Filter */}
          <div className="w-full sm:w-52">
            <Select
              aria-label="Filter by expense type"
              value={filters.expenseType}
              onChange={(e) =>
                update("expenseType", e.target.value as "" | ExpenseType)
              }
            >
              <option value="">
                {activeTab === "mine" ? "All expense types" : "All types"}
              </option>
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          {/* Reset Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </Card>

      {/* 5. Data Table Views */}
      {currentList.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={7} />
      ) : currentList.isError ? (
        currentList.error instanceof ApiError &&
        currentList.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to expense claims"
          >
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void currentList.refetch()} />
        )
      ) : displayedRows.length === 0 ? (
        <Card>
          <EmptyState
            title={
              hasFilters
                ? "No claims match these filters"
                : activeTab === "mine"
                  ? "No expense claims yet"
                  : "No claims from team yet"
            }
            description={
              hasFilters
                ? "Try adjusting your search terms or reset the filters."
                : activeTab === "mine"
                  ? "Submit an expense claim to track reimbursements."
                  : "Expense claims submitted by your team members will appear here."
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Reset filters
                </Button>
              ) : activeTab === "mine" && canCreateMine ? (
                <Button
                  size="sm"
                  onClick={() => setSubmitOpen(true)}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Submit Expense Claim
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {activeTab === "mine" ? (
            /* My Claims Table */
            <DataTable
              caption="My expense claims"
              rows={displayedRows}
              getRowKey={(r) => String(r.id)}
              columns={[
                {
                  header: "#",
                  cell: (r) => (
                    <span className="text-theme-xs text-gray-500 font-medium">
                      {r.rowNumber}
                    </span>
                  ),
                },
                {
                  header: "Date",
                  cell: (r) => (
                    <span className="text-theme-sm text-gray-800 dark:text-gray-200">
                      {formatExpenseDate(r.expenseDate)}
                    </span>
                  ),
                },
                {
                  header: "Expense Type",
                  cell: (r) => (
                    <span className="font-medium text-theme-sm text-gray-900 dark:text-white/90">
                      {r.expenseType}
                    </span>
                  ),
                },
                {
                  header: "Description",
                  cell: (r) => (
                    <span className="text-theme-xs text-gray-600 dark:text-gray-400 truncate max-w-xs block">
                      {r.description}
                    </span>
                  ),
                },
                {
                  header: "Amount",
                  cell: (r) => (
                    <span className="font-semibold text-theme-sm text-gray-900 dark:text-white/90">
                      {formatIndianCurrency(r.amount)}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: (r) => <ExpenseClaimStatusBadge status={r.status} />,
                },
                {
                  header: "Actions",
                  cell: (r) => (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`View claim for ${r.expenseType}`}
                        onClick={() => setDetailsTarget(r)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            /* Team Claims Table */
            <DataTable
              caption="Expense claims"
              rows={displayedRows}
              getRowKey={(r) => String(r.id)}
              columns={[
                {
                  header: "#",
                  cell: (r) => (
                    <span className="text-theme-xs text-gray-500 font-medium">
                      {r.rowNumber}
                    </span>
                  ),
                },
                {
                  header: "Employee",
                  cell: (r) => (
                    <EmployeeIdentity
                      name={r.employee.fullName}
                      code={employeeCodeMap.get(r.employee.id)}
                      size="sm"
                    />
                  ),
                },
                {
                  header: "Date",
                  cell: (r) => (
                    <span className="text-theme-sm text-gray-800 dark:text-gray-200">
                      {formatExpenseDate(r.expenseDate)}
                    </span>
                  ),
                },
                {
                  header: "Expense Type",
                  cell: (r) => (
                    <span className="font-medium text-theme-sm text-gray-900 dark:text-white/90">
                      {r.expenseType}
                    </span>
                  ),
                },
                {
                  header: "Description",
                  cell: (r) => (
                    <span className="text-theme-xs text-gray-600 dark:text-gray-400 truncate max-w-xs block">
                      {r.description}
                    </span>
                  ),
                },
                {
                  header: "Amount",
                  cell: (r) => (
                    <span className="font-semibold text-theme-sm text-gray-900 dark:text-white/90">
                      {formatIndianCurrency(r.amount)}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: (r) => <ExpenseClaimStatusBadge status={r.status} />,
                },
                {
                  header: "Actions",
                  cell: (r) => {
                    const isPending = r.status === "PENDING";
                    return (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`View claim by ${r.employee.fullName}`}
                          onClick={() => setDetailsTarget(r)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {canDecide && isPending ? (
                          <>
                            <button
                              type="button"
                              aria-label={`Approve claim by ${r.employee.fullName}`}
                              onClick={() =>
                                setDecision({ claim: r, decision: "APPROVED" })
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 transition-colors"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Reject claim by ${r.employee.fullName}`}
                              onClick={() =>
                                setDecision({ claim: r, decision: "REJECTED" })
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-950/60 dark:text-error-300 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    );
                  },
                },
              ]}
            />
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-1 py-3 dark:border-gray-800">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, totalRecords)} of {totalRecords}{" "}
              records
            </span>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {/* 6. Centered Modals */}
      {submitOpen ? (
        <SubmitExpenseClaimDialog open onClose={() => setSubmitOpen(false)} />
      ) : null}

      <ExpenseClaimDetailsDialog
        open={Boolean(detailsTarget)}
        onClose={() => setDetailsTarget(null)}
        claim={detailsTarget}
        employeeCode={
          detailsTarget
            ? employeeCodeMap.get(detailsTarget.employee.id)
            : undefined
        }
        canDecide={canDecide}
        onDecide={(claim, dec) => setDecision({ claim, decision: dec })}
      />

      {decision ? (
        <DecideExpenseClaimDialog
          open
          onClose={() => setDecision(null)}
          claim={decision.claim}
          decision={decision.decision}
        />
      ) : null}
    </div>
  );
}
