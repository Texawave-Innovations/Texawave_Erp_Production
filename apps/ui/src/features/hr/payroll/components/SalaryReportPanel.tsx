"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { downloadText } from "../download";
import { periodLabel } from "../format";
import { useAllRunEntries, usePeriods } from "../hooks";
import {
  exportSalaryReportExcel,
  optionsOf,
  reportRun,
  reportTitle,
  rupees,
  type SalaryReportRow,
  toCsv,
  toReportRow,
  totalsOf,
} from "../salary-report";
import type { PayrollPeriod } from "../types";
import { PayrollStatusBadge } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

type Run = PayrollPeriod["runs"][number];

/** Runs a report can read: approved first, then processed (newest first). */
function reportableRuns(period: PayrollPeriod | undefined): Run[] {
  if (!period) return [];
  return (period.runs ?? [])
    .filter((r) => r.status === "APPROVED" || r.status === "PROCESSED")
    .sort((a, b) =>
      a.status === b.status
        ? b.runNumber - a.runNumber
        : a.status === "APPROVED"
          ? -1
          : 1,
    );
}

/** Calculate calendar days in the given period month */
function getDaysInMonth(year: number, month: number): number {
  if (!year || !month) return 30;
  return new Date(year, month, 0).getDate();
}

/**
 * HR → Payroll → Salary report:
 * 19-column spreadsheet-grade salary computation and attendance audit report.
 */
export function SalaryReportPanel() {
  const periods = usePeriods({ page: 1, limit: 100 });
  const allPeriods = periods.data?.data ?? [];

  const [periodId, setPeriodId] = useState<number | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Active period selection
  const period = useMemo(() => {
    if (periodId) {
      const found = allPeriods.find((p) => p.id === periodId);
      if (found) return found;
    }
    // Prefer period with reportable runs
    const withRuns = allPeriods.find((p) => reportableRuns(p).length > 0);
    return withRuns ?? allPeriods[0] ?? null;
  }, [allPeriods, periodId]);

  const runs = useMemo(() => reportableRuns(period ?? undefined), [period]);

  const run = useMemo(() => {
    if (runId) {
      const found = runs.find((r) => r.id === runId);
      if (found) return found;
    }
    return reportRun(runs);
  }, [runs, runId]);

  const daysInPeriod = period ? getDaysInMonth(period.year, period.month) : 30;

  // Fetch entries for the active run
  const entries = useAllRunEntries(run?.id ?? null);

  const allRows = useMemo(
    () => (entries.data ?? []).map((e) => toReportRow(e, daysInPeriod)),
    [entries.data, daysInPeriod],
  );

  const departments = useMemo(
    () => optionsOf(allRows, "department"),
    [allRows],
  );

  const needle = search.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (departmentId && r.department?.id !== departmentId) return false;
      if (needle) {
        const matchesName = r.fullName.toLowerCase().includes(needle);
        const matchesCode = r.employeeCode.toLowerCase().includes(needle);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    });
  }, [allRows, departmentId, needle]);

  const totals = useMemo(() => totalsOf(filteredRows), [filteredRows]);

  const meta = useMemo(() => {
    if (!period || !run) return null;
    return { year: period.year, month: period.month, runNumber: run.runNumber };
  }, [period, run]);

  const hasFilters = Boolean(search.trim() || departmentId);

  function handleClearFilters() {
    setSearch("");
    setDepartmentId(null);
  }

  function handleExportCsv() {
    if (!meta || filteredRows.length === 0) return;
    const csv = toCsv(meta, filteredRows);
    downloadText(csv.fileName, csv.content);
    setExportOpen(false);
  }

  function handleExportExcel() {
    if (!meta || filteredRows.length === 0) return;
    exportSalaryReportExcel(meta, filteredRows);
    setExportOpen(false);
  }

  if (periods.isPending || periods.isError) {
    return <QueryState query={periods} area="payroll periods" />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Banner matching reference aesthetics */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-linear-to-r from-sky-50/80 via-white to-blue-50/60 p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                Monthly Salary Report
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Salary calculations and attendance proration based on present
                days for{" "}
                <span className="font-semibold text-brand-600 dark:text-sky-300">
                  {period ? periodLabel(period) : "Payroll"}
                </span>
                {run ? ` (Run #${run.runNumber})` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Export Dropdown in Header */}
        <div className="relative">
          <Button
            variant="secondary"
            disabled={!entries.isSuccess || filteredRows.length === 0}
            onClick={() => setExportOpen((prev) => !prev)}
            className="border-sky-200 hover:border-brand-400 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs"
          >
            <Download className="mr-1.5 h-4 w-4 text-brand-500" />
            Export Report
            <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
          </Button>

          {exportOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setExportOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-sky-100 bg-white py-1.5 shadow-xl ring-1 ring-black/5 z-50 dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-emerald-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Export Excel (.xls)
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-brand-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <FileText className="h-4 w-4 text-brand-500" />
                  Export CSV (.csv)
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. 4 Executive Summary KPI Metric Cards (Matching Image 1 Reference) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Monthly Gross */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              Total Gross
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {rupees(totals.grossMonthly)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Contracted monthly base
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Total Earnings Earned */}
        <div className="flex items-center justify-between rounded-2xl border border-blue-200/90 bg-white p-4 shadow-2xs dark:border-blue-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Total Earnings
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {rupees(totals.earnedGross)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Prorated present earnings
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/40">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Total Deductions (PF+ESI+Loans) */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/90 bg-white p-4 shadow-2xs dark:border-amber-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Total Deductions (PF+ESI)
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {rupees(totals.totalDeductions)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              PF {rupees(totals.pf)} · ESI {rupees(totals.esi)}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        {/* Net Payable Disbursed */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/90 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Net Payable
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {rupees(totals.net)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Disburseable remuneration
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Single-Baseline Control Toolbar (Matching Reference Filter Row) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-70">
          {/* Period Selector */}
          <div className="w-full sm:w-44">
            <Select
              aria-label="Select Payroll Period"
              value={period?.id ?? ""}
              onChange={(e) => {
                setPeriodId(Number(e.target.value));
                setRunId(null);
                handleClearFilters();
              }}
            >
              {allPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p)}
                </option>
              ))}
            </Select>
          </div>

          {/* Run Selector */}
          {runs.length > 0 && (
            <div className="w-full sm:w-52">
              <Select
                aria-label="Select Payroll Run"
                value={run?.id ?? ""}
                onChange={(e) => {
                  setRunId(Number(e.target.value));
                  handleClearFilters();
                }}
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    Run #{r.runNumber} —{" "}
                    {r.status === "APPROVED" ? "Approved" : "Processed"}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Department Filter */}
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by department"
              value={departmentId ?? ""}
              onChange={(e) =>
                setDepartmentId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Live Search */}
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-xs text-gray-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-brand-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Active Employee Count Badge (e.g. '27 employees') */}
          <div className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-brand-600 border border-sky-100 dark:bg-slate-800 dark:text-sky-300 dark:border-slate-700">
            {filteredRows.length} employee{filteredRows.length === 1 ? "" : "s"}
          </div>

          {hasFilters && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleClearFilters}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 text-xs"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {run && run.status !== "APPROVED" && (
        <Alert variant="warning" title="Run Not Yet Approved">
          This payroll run is in processed status. Figures are provisional until
          final HR/Admin approval.
        </Alert>
      )}

      {/* 4. Main 19-Column Salary Report Spreadsheet Table */}
      <div className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        {!run ? (
          <EmptyState
            title="No Payroll Runs Found"
            description={`No processed runs were found for ${period ? periodLabel(period) : "this period"}. Process a payroll run in the "Periods & runs" tab to view this salary report.`}
          />
        ) : entries.isPending ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Loading payroll calculation entries…
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title={
              hasFilters ? "No Matching Employees" : "No Entries In This Run"
            }
            description={
              hasFilters
                ? "No employee in this run matches your search or department filter."
                : "This run does not contain any calculated employee entries."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <DataTable<SalaryReportRow>
              caption="Salary Report Spreadsheet"
              rows={filteredRows}
              getRowKey={(r) => String(r.entryId)}
              columns={[
                {
                  header: "#",
                  cell: (_, idx) => (
                    <span className="text-xs font-bold text-slate-400">
                      {(idx ?? 0) + 1}
                    </span>
                  ),
                  className: "w-10 text-center",
                  headerClassName: "text-center",
                },
                {
                  header: "Emp ID",
                  cell: (r) => (
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {r.employeeCode}
                    </span>
                  ),
                },
                {
                  header: "Name",
                  cell: (r) => (
                    <div className="flex flex-col min-w-35">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {r.fullName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {r.department?.name || r.team?.name || "General"}
                      </span>
                    </div>
                  ),
                },
                {
                  header: "Days",
                  cell: (r) => (
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {r.days}
                    </span>
                  ),
                  className: "text-center",
                  headerClassName: "text-center",
                },
                {
                  header: "Present",
                  cell: (r) => (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {r.payableDays}
                    </span>
                  ),
                  className: "text-center",
                  headerClassName: "text-center",
                },
                {
                  header: "Absent",
                  cell: (r) => (
                    <span
                      className={`text-xs font-bold ${
                        r.lopDays > 0 ? "text-rose-500" : "text-slate-400"
                      }`}
                    >
                      {r.lopDays}
                    </span>
                  ),
                  className: "text-center",
                  headerClassName: "text-center",
                },
                {
                  header: "Gross/Mo",
                  cell: (r) => (
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {rupees(r.grossMonthly)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Per Day",
                  cell: (r) => (
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {rupees(r.perDayRate)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Total Earn",
                  cell: (r) => (
                    <span className="text-xs font-bold text-blue-600 dark:text-sky-300">
                      {rupees(r.earnedGross)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "PF",
                  cell: (r) => (
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {r.pf > 0 ? rupees(r.pf) : "—"}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "ESI",
                  cell: (r) => (
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {r.esi > 0 ? rupees(r.esi) : "—"}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Deductions",
                  cell: (r) => (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {rupees(r.totalDeductions)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Net Pay",
                  cell: (r) => (
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                      {rupees(r.net)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Bank Ac",
                  cell: (r) => (
                    <div className="flex flex-col text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {r.bankAccount}
                      </span>
                      {r.bankName !== "—" && (
                        <span className="text-[10px] text-slate-400">
                          {r.bankName}
                        </span>
                      )}
                    </div>
                  ),
                },
              ]}
            />

            {/* Bottom summary bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sky-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Totals for {filteredRows.length} Employees:
              </span>
              <div className="flex flex-wrap items-center gap-4 font-bold">
                <span>
                  Gross:{" "}
                  <strong className="text-slate-800 dark:text-white">
                    {rupees(totals.grossMonthly)}
                  </strong>
                </span>
                <span>
                  Earned:{" "}
                  <strong className="text-blue-600 dark:text-sky-300">
                    {rupees(totals.earnedGross)}
                  </strong>
                </span>
                <span>
                  Deductions:{" "}
                  <strong className="text-amber-600">
                    {rupees(totals.totalDeductions)}
                  </strong>
                </span>
                <span>
                  Net Disbursement:{" "}
                  <strong className="text-emerald-600">
                    {rupees(totals.net)}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
