"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Plus,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Button,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import { useEmployees } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import { isoDate, money } from "../format";
import { useLoans, useMyLoans, useSalaries } from "../hooks";
import {
  LOAN_READ,
  LOAN_WRITE,
  MY_LOAN_READ,
  MY_LOAN_WRITE,
  SALARY_READ,
} from "../permissions";
import { type Loan } from "../types";
import { IssueLoanDialog, LoanDetailDialog, outstanding } from "./LoanDialogs";
import {
  ManageEmployeeData,
  ManageEmployeeLoanDialog,
} from "./ManageEmployeeLoanDialog";
import { StatusPill } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";
import { HrPageHeader } from "@/features/hr/components";

const PAGE_SIZE = 10;

interface EmployeeLoanRegistryRow {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  status: string;
  department: string;
  grossSalary: number;
  attendanceText: string;
  loansCount: number;
  approvedCount: number;
  approvedAmount: number;
  outstandingBalance: number;
  activeLoan?: Loan | null;
}

/** The signed-in employee's own loans (read-only self-service). */
export function MyLoansSection() {
  const canRead = usePermission(MY_LOAN_READ);
  const canRequest = usePermission(MY_LOAN_WRITE);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const query = useMyLoans({ page, limit: PAGE_SIZE }, canRead);
  const rows = query.data?.data ?? [];
  const open = rows.find((l) => l.id === openId) ?? null;

  // Summary statistics across personal loans
  const summary = useMemo(() => {
    let totalOutstanding = 0;
    let totalEmi = 0;
    let activeLoans = 0;
    let totalPrincipal = 0;

    for (const l of rows) {
      totalPrincipal += Number(l.principalAmount) || 0;
      const rem = outstanding(l) / 100;
      totalOutstanding += rem;
      if (l.status === "ACTIVE") {
        activeLoans += 1;
        totalEmi += Number(l.emiAmount) || 0;
      }
    }

    return {
      activeLoans,
      totalOutstanding,
      totalEmi,
      totalPrincipal,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((l) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !l.loanNumber.toLowerCase().includes(q) &&
          !(l.reason ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  const hasFilters = statusFilter !== "" || searchQuery !== "";

  if (!canRead) return null;
  if (
    query.error instanceof ApiError &&
    query.error.errorCode === "NOT_AN_EMPLOYEE"
  )
    return null;

  const metricCards = [
    {
      label: "Active Loans",
      value: summary.activeLoans.toString(),
      subtext: "Running advances",
      Icon: CreditCard,
      color: "text-brand-500 bg-sky-50 dark:bg-sky-950/40",
    },
    {
      label: "Total Outstanding",
      value: money(summary.totalOutstanding),
      subtext: "Remaining principal",
      Icon: AlertCircle,
      color: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
    },
    {
      label: "Monthly EMI",
      value: money(summary.totalEmi),
      subtext: "Salary deduction",
      Icon: Clock,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "Principal Borrowed",
      value: money(summary.totalPrincipal),
      subtext: "Total loan volume",
      Icon: Coins,
      color: "text-slate-600 bg-slate-100 dark:bg-slate-800",
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-reveal pb-12">
      {/* 1. Page Header with 3D Payroll Hero */}
      <HrPageHeader
        title="My Loans & Advances"
        description="View active company loans, track EMI deduction schedules, and apply for personal loans."
        icon3d="payroll"
        action={
          canRequest ? (
            <Button
              onClick={() => setRequesting(true)}
              className="flex items-center gap-1.5 rounded-xl font-bold shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Request a loan</span>
            </Button>
          ) : null
        }
      />

      {/* 2. Interactive Status Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3.5 rounded-2xl border border-sky-200/90 bg-white p-4 text-left shadow-2xs dark:border-slate-700/80 dark:bg-slate-850"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.color}`}
            >
              <card.Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                {card.label}
              </span>
              <span className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                {card.value}
              </span>
              <span className="block text-[11px] font-medium text-slate-400 truncate">
                {card.subtext}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Search & Filter Bar: Compact Single-Line Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850">
        <div className="w-full sm:w-72">
          <Input
            aria-label="Search loans"
            placeholder="Search by loan # or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="CLOSED">Closed / Repaid</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("");
              setSearchQuery("");
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-red-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear filters</span>
          </Button>
        ) : null}
      </div>

      <QueryState query={query} area="your loans" />

      {query.isSuccess && rows.length === 0 ? (
        <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title="No Personal Loans"
            description="You do not currently have any active or past company loans."
          />
        </div>
      ) : null}

      {query.isSuccess && rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-white shadow-xs dark:border-slate-700/80 dark:bg-slate-900">
          <DataTable<Loan>
            className="border-0 shadow-none rounded-none"
            caption="My loans"
            rows={filteredRows}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Loan #",
                cell: (r) => (
                  <span className="font-bold text-[#0a3271] dark:text-white">
                    {r.loanNumber}
                  </span>
                ),
              },
              {
                header: "Principal",
                cell: (r) => money(r.principalAmount),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "EMI",
                cell: (r) => `${money(r.emiAmount)} × ${r.emiMonths} mos`,
                className:
                  "whitespace-nowrap font-medium text-slate-700 dark:text-slate-300",
              },
              {
                header: "Outstanding",
                cell: (r) => (
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {money(outstanding(r) / 100)}
                  </span>
                ),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Disbursed",
                cell: (r) => (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                    <Calendar className="h-3.5 w-3.5 text-brand-500" />
                    <span>{isoDate(r.disbursedDate)}</span>
                  </div>
                ),
              },
              {
                header: "Status",
                cell: (r) => {
                  const pending = r.skipRequests.filter(
                    (s) => s.status === "PENDING",
                  ).length;
                  return (
                    <span className="flex flex-col items-start gap-1">
                      <StatusPill status={r.status} />
                      {pending > 0 ? (
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                          {pending} skip pending
                        </span>
                      ) : null}
                    </span>
                  );
                },
              },
              {
                header: "Action",
                className: "text-right",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`View loan ${r.loanNumber}`}
                    onClick={() => setOpenId(r.id)}
                    className="text-xs font-semibold hover:border-brand-300 hover:text-brand-600"
                  >
                    View Schedule
                  </Button>
                ),
              },
            ]}
          />
          {(query.data.meta?.totalPages ?? 1) > 1 ? (
            <div className="border-t border-sky-100 p-3 dark:border-slate-800">
              <Pagination
                page={page}
                totalPages={query.data.meta?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <LoanDetailDialog
          loan={open}
          selfService
          onClose={() => setOpenId(null)}
        />
      ) : null}

      {requesting ? (
        <IssueLoanDialog selfService onClose={() => setRequesting(false)} />
      ) : null}
    </div>
  );
}

/** HR & Team Loans Management (Matching Reference Image 1) */
function HrLoansSection() {
  const canRead = usePermission(LOAN_READ);
  const canWrite = usePermission(LOAN_WRITE);
  const canReadSalaries = usePermission(SALARY_READ);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [issuing, setIssuing] = useState(false);
  const [managingEmployee, setManagingEmployee] =
    useState<ManageEmployeeData | null>(null);

  // 1. Fetch organization loans for statistics and active mapping
  const allLoansQuery = useLoans({ page: 1, limit: 100 }, canRead);
  const allLoans = allLoansQuery.data?.data ?? [];

  // 2. Fetch all employees in scope
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const employeesList = employeesQuery.data?.data ?? [];

  // 3. Fetch salary structures for gross salary context
  const salariesQuery = useSalaries({ page: 1, limit: 100 }, canReadSalaries);
  const salariesList = salariesQuery.data?.data ?? [];

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    employeesList.forEach((e) => {
      const dept = e.team?.name || "General";
      if (dept) set.add(dept);
    });
    return Array.from(set).sort();
  }, [employeesList]);

  // Map employee rows with real salary and loan stats
  const registryRows: EmployeeLoanRegistryRow[] = useMemo(() => {
    // If employeesList is empty, fall back to employee data found in allLoans
    if (employeesList.length === 0 && allLoans.length > 0) {
      const seen = new Map<number, EmployeeLoanRegistryRow>();
      allLoans.forEach((l) => {
        if (!seen.has(l.employee.id)) {
          const empLoans = allLoans.filter(
            (x) => x.employee.id === l.employee.id,
          );
          const activeLoans = empLoans.filter((x) => x.status === "ACTIVE");
          const approved = empLoans.filter(
            (x) => x.status === "ACTIVE" || x.status === "CLOSED",
          );
          const approvedAmt = approved.reduce(
            (sum, x) => sum + Number(x.principalAmount || 0),
            0,
          );
          const outstandingBal = activeLoans.reduce(
            (sum, x) => sum + Math.round(outstanding(x) / 100),
            0,
          );

          seen.set(l.employee.id, {
            employeeId: l.employee.id,
            employeeCode: l.employee.employeeCode,
            fullName: l.employee.fullName,
            status: "ACTIVE",
            department: "General",
            grossSalary: Number(l.principalAmount) || 0,
            attendanceText: "Active",
            loansCount: activeLoans.length,
            approvedCount: approved.length,
            approvedAmount: approvedAmt,
            outstandingBalance: outstandingBal,
            activeLoan: activeLoans[0] ?? null,
          });
        }
      });
      return Array.from(seen.values());
    }

    return employeesList.map((emp) => {
      const empLoans = allLoans.filter((l) => l.employee.id === emp.id);
      const activeLoans = empLoans.filter((l) => l.status === "ACTIVE");
      const approved = empLoans.filter(
        (l) => l.status === "ACTIVE" || l.status === "CLOSED",
      );
      const approvedAmt = approved.reduce(
        (sum, l) => sum + Number(l.principalAmount || 0),
        0,
      );
      const outstandingBal = activeLoans.reduce(
        (sum, l) => sum + Math.round(outstanding(l) / 100),
        0,
      );

      // Find in-force or latest salary for this employee
      const empSalary = salariesList.find((s) => s.employee.id === emp.id);
      const gross = Number(empSalary?.grossMonthly || 0);

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        status: emp.status,
        department: emp.team?.name || "General",
        grossSalary: gross,
        attendanceText: "Active",
        loansCount: activeLoans.length,
        approvedCount: approved.length,
        approvedAmount: approvedAmt,
        outstandingBalance: outstandingBal,
        activeLoan: activeLoans[0] ?? null,
      };
    });
  }, [employeesList, allLoans, salariesList]);

  // Filtered rows based on toolbar inputs
  const filteredRows = useMemo(() => {
    let result = registryRows;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          r.employeeCode.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q),
      );
    }

    if (departmentFilter) {
      result = result.filter((r) => r.department === departmentFilter);
    }

    if (statusFilter === "has-loans") {
      result = result.filter((r) => r.loansCount > 0);
    } else if (statusFilter === "no-loans") {
      result = result.filter((r) => r.loansCount === 0);
    } else if (statusFilter === "outstanding") {
      result = result.filter((r) => r.outstandingBalance > 0);
    }

    return result;
  }, [registryRows, search, departmentFilter, statusFilter]);

  // Paginated slice
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;

  // KPI Metrics Calculation (Matching Reference Image 1)
  const activeEmployeesCount = registryRows.filter(
    (r) => r.status === "ACTIVE",
  ).length;
  const activeLoansCount = allLoans.filter((l) => l.status === "ACTIVE").length;
  const pendingApprovalsCount = allLoans.filter(
    (l) => l.status === "PENDING_HR" || l.status === "PENDING_ADMIN",
  ).length;
  const fullyRepaidCount = allLoans.filter((l) => l.status === "CLOSED").length;

  const hasFilters =
    search !== "" || departmentFilter !== "" || statusFilter !== "";

  const handleClearFilters = () => {
    setSearch("");
    setDepartmentFilter("");
    setStatusFilter("");
    setPage(1);
  };

  if (!canRead) return null;

  return (
    <div className="flex flex-col gap-6 animate-reveal">
      {/* Executive Header Banner - Soft Low-Contrast Styling */}
      <div className="relative overflow-visible rounded-2xl border border-sky-200/80 bg-linear-to-r from-sky-50/90 via-sky-50/40 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-700 dark:bg-slate-800 dark:text-sky-300">
                HR Payroll
              </span>
            </div>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-[#0a3271] dark:text-white sm:text-2xl">
              Employee Loans Management
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Manage all employee loan requests with automated monthly EMI
              deductions and flexible tenure terms.
            </p>
          </div>
          {canWrite ? (
            <Button
              onClick={() => setIssuing(true)}
              className="bg-[#1769F5] hover:bg-[#1258d4] text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-transform hover:scale-102"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Request Loan
            </Button>
          ) : null}
        </div>
      </div>

      {/* 4 KPI Metric Cards (Matching Reference Image 1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Active Employees */}
        <button
          type="button"
          onClick={handleClearFilters}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "" && !hasFilters
              ? "border-2 border-brand-500 bg-sky-50/50 shadow-md ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                Active Employees
              </p>
              <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                All
              </span>
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {activeEmployeesCount || registryRows.length}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Status: Active
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 transition-transform group-hover:scale-105 dark:border-slate-700 dark:bg-slate-800">
            <Users className="h-5 w-5" />
          </div>
        </button>

        {/* Total Loans */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) =>
              prev === "has-loans" ? "" : "has-loans",
            );
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "has-loans"
              ? "border-2 border-emerald-500 bg-emerald-50/60 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-950/30"
              : "border border-emerald-200/90 bg-white shadow-2xs hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Total Loans
              </p>
              {statusFilter === "has-loans" ? (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                  Active Filter
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {allLoans.length}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Active: {activeLoansCount}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-105 dark:border-emerald-900 dark:bg-emerald-950/40">
            <CreditCard className="h-5 w-5" />
          </div>
        </button>

        {/* Pending Approvals */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) =>
              prev === "outstanding" ? "" : "outstanding",
            );
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "outstanding"
              ? "border-2 border-amber-500 bg-amber-50/60 shadow-md ring-2 ring-amber-500/20 dark:border-amber-400 dark:bg-amber-950/30"
              : "border border-amber-200/90 bg-white shadow-2xs hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pending Approvals
              </p>
              {pendingApprovalsCount > 0 ? (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                  Needs Review
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {pendingApprovalsCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Awaiting decision
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition-transform group-hover:scale-105 dark:border-amber-900 dark:bg-amber-950/40">
            <Clock className="h-5 w-5" />
          </div>
        </button>

        {/* Fully Repaid */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              Fully Repaid
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {fullyRepaidCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Loans settled
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (Matching Reference Image 1) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-70">
          {/* Live Search */}
          <div className="relative flex-1 min-w-55">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee by name or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-theme-sm text-gray-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-brand-400"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* Department Filter */}
          <Select
            aria-label="Filter by department"
            className="w-full sm:w-48"
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </Select>

          {/* Loan Status Filter */}
          <Select
            aria-label="Filter by status"
            className="w-full sm:w-44"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Loan Records</option>
            <option value="has-loans">Active Loans Only</option>
            <option value="outstanding">With Outstanding Balance</option>
            <option value="no-loans">No Active Loans</option>
          </Select>

          {hasFilters && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleClearFilters}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        {canWrite && (
          <Button
            onClick={() => setIssuing(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white font-bold"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Request Loan
          </Button>
        )}
      </div>

      {/* Main Employee Registry Table (Matching Reference Image 1) */}
      <div className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        {paginatedRows.length === 0 ? (
          <EmptyState
            title="No Employees Found"
            description={
              hasFilters
                ? "No employees match your search criteria. Try adjusting or clearing your filters."
                : "No employee records found."
            }
          />
        ) : (
          <>
            <DataTable<EmployeeLoanRegistryRow>
              caption="Employee Loans Directory"
              rows={paginatedRows}
              getRowKey={(r) => String(r.employeeId)}
              columns={[
                {
                  header: "Emp ID",
                  cell: (r) => (
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {r.employeeCode}
                    </span>
                  ),
                },
                {
                  header: "Name",
                  cell: (r) => (
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {r.fullName}
                      </span>
                      <span className="text-theme-xs text-gray-500">
                        {r.department}
                      </span>
                    </div>
                  ),
                },
                {
                  header: "Status",
                  cell: (r) => (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                      {r.status.toLowerCase()}
                    </span>
                  ),
                },
                {
                  header: "Department",
                  cell: (r) => r.department,
                },
                {
                  header: "Gross Salary",
                  cell: (r) =>
                    r.grossSalary > 0 ? (
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {money(r.grossSalary)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Attendance",
                  cell: (r) => (
                    <span className="text-theme-xs text-gray-500">
                      {r.attendanceText}
                    </span>
                  ),
                },
                {
                  header: "Loans",
                  cell: (r) => (
                    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-theme-xs font-bold text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                      {r.loansCount}
                    </span>
                  ),
                  className: "text-center",
                  headerClassName: "text-center",
                },
                {
                  header: "Approved",
                  cell: (r) => (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold whitespace-nowrap">
                      {r.approvedCount} ({money(r.approvedAmount)})
                    </span>
                  ),
                },
                {
                  header: "Outstanding Balance",
                  cell: (r) => (
                    <span
                      className={`font-bold whitespace-nowrap ${
                        r.outstandingBalance > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {money(r.outstandingBalance)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Action",
                  cell: (r) => (
                    <Button
                      size="sm"
                      onClick={() =>
                        setManagingEmployee({
                          id: r.employeeId,
                          employeeCode: r.employeeCode,
                          fullName: r.fullName,
                          departmentName: r.department,
                          status: r.status,
                        })
                      }
                      className="bg-brand-500 hover:bg-brand-600 text-white font-bold"
                    >
                      <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                      Manage
                    </Button>
                  ),
                },
              ]}
            />

            <div className="mt-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Dialogs */}
      {issuing && <IssueLoanDialog onClose={() => setIssuing(false)} />}

      {managingEmployee && (
        <ManageEmployeeLoanDialog
          employee={managingEmployee}
          onClose={() => setManagingEmployee(null)}
        />
      )}
    </div>
  );
}

/** HR → Payroll → Loans: Main Component with View Mode Switcher */
export function LoansPanel() {
  const canReadMyLoans = usePermission(MY_LOAN_READ);
  const canReadHrLoans = usePermission(LOAN_READ);
  const [activeTab, setActiveTab] = useState<"hr" | "my">(
    canReadHrLoans ? "hr" : "my",
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Top Segmented Mode Switcher */}
      {canReadHrLoans && canReadMyLoans && (
        <div className="flex border-b border-gray-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("hr")}
            className={`border-b-2 py-3 px-5 text-theme-sm font-bold transition-colors ${
              activeTab === "hr"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-sky-300"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Team & Employee Loans
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("my")}
            className={`border-b-2 py-3 px-5 text-theme-sm font-bold transition-colors ${
              activeTab === "my"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-sky-300"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            My Loans & Requests
          </button>
        </div>
      )}

      {activeTab === "hr" && canReadHrLoans && <HrLoansSection />}
      {activeTab === "my" && canReadMyLoans && <MyLoansSection />}
    </div>
  );
}
