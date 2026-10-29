"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
import { usePermission } from "@/hooks/usePermission";
import { downloadPayslipPdf } from "../api";
import { downloadBlob } from "../download";
import { days, describeError, isoDate, money, periodLabel } from "../format";
import {
  useGeneratePayslips,
  useMyPayslips,
  usePayslips,
  usePeriods,
} from "../hooks";
import { MY_PAYSLIP_READ, PAYROLL_WRITE, PAYSLIP_READ } from "../permissions";
import type { Payslip } from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { exportPayslipsCsv, exportPayslipsExcel } from "./payslip-export";
import { PayslipDocumentDialog } from "./PayslipDocumentDialog";
import { PeriodFilterSelect } from "./PeriodFilterSelect";
import { QueryState } from "./QueryState";
import { RegeneratePayslipDialog } from "./RegeneratePayslipDialog";
import { HrPageHeader } from "@/features/hr/components";

const PAGE_SIZE = 12;

/**
 * Fetches the PDF with the caller's token and saves it. The API renders it
 * with a headless browser, so it can take a moment — the button shows that.
 */
export function DownloadPdfButton({
  payslip,
  selfService,
  size = "sm",
}: {
  payslip: Payslip;
  selfService: boolean;
  size?: "sm" | "md";
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const pdf = await downloadPayslipPdf(payslip.id, selfService);
      downloadBlob(`${payslip.payslipNumber}.pdf`, pdf);
    } catch (err) {
      toast({
        title: "Could not download the payslip",
        description: describeError(err),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size={size}
      variant="secondary"
      loading={busy}
      aria-label={`Download PDF of payslip ${payslip.payslipNumber}`}
      onClick={() => void handleClick()}
      className="text-xs font-semibold hover:border-brand-300"
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      PDF
    </Button>
  );
}

/** Generates payslips from a period's approved run */
function GeneratePayslipsDialog({ onClose }: { onClose: () => void }) {
  const generate = useGeneratePayslips();
  const periods = usePeriods({ page: 1, limit: 100 });
  const { toast } = useToast();
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const ready = (periods.data?.data ?? []).filter(
    (p) => p.status === "APPROVED" || p.status === "FINALIZED",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodId) {
      setError("Choose a payroll period");
      return;
    }
    setError(undefined);
    setServerError(null);
    try {
      const rows = await generate.mutateAsync({
        payrollPeriodId: periodId,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast({
        title: `${rows.length} payslip${rows.length === 1 ? "" : "s"} generated successfully`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Generate Payslips" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          Payslips will be generated for all finalized employees in this payroll
          period.
        </p>
        <FormField
          label="Payroll Period"
          required
          error={error}
          hint="Only periods with an approved or finalized run are eligible."
        >
          {(f) => (
            <Select
              {...f}
              disabled={periods.isPending}
              value={periodId ?? ""}
              onChange={(e) =>
                setPeriodId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">
                {periods.isPending
                  ? "Loading periods…"
                  : periods.isError
                    ? "Could not load periods"
                    : ready.length === 0
                      ? "No period has an approved run yet"
                      : "Choose a period"}
              </option>
              {ready.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Regeneration Reason"
          hint="Required only if re-generating already issued payslips (at least 10 chars)."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              placeholder="e.g. Bank account update for revised disbursement..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={generate.isPending}
          submitLabel="Generate Now"
        />
      </form>
    </Dialog>
  );
}

/** The signed-in employee's own personal payslips */
export function MyPayslipsSection() {
  const canRead = usePermission(MY_PAYSLIP_READ);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Payslip | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const query = useMyPayslips({ page, limit: PAGE_SIZE }, canRead);
  const rows = query.data?.data ?? [];

  // Summary statistics across available payslips
  const summary = useMemo(() => {
    if (rows.length === 0) {
      return { latestNet: 0, avgNet: 0, totalSlips: 0, latestPeriod: "—" };
    }
    const latest = rows[0];
    const totalAmount = rows.reduce(
      (acc, r) => acc + (Number(r.netPayable) || 0),
      0,
    );
    return {
      latestNet: latest ? Number(latest.netPayable) || 0 : 0,
      avgNet: Math.round(totalAmount / rows.length),
      totalSlips: query.data?.meta?.total ?? rows.length,
      latestPeriod: latest?.payrollPeriod
        ? periodLabel(latest.payrollPeriod)
        : "—",
    };
  }, [rows, query.data?.meta?.total]);

  // Filtered rows for client search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => {
      const num = r.payslipNumber.toLowerCase();
      const p = r.payrollPeriod
        ? periodLabel(r.payrollPeriod).toLowerCase()
        : "";
      return num.includes(q) || p.includes(q);
    });
  }, [rows, searchQuery]);

  if (!canRead) return null;
  if (
    query.error instanceof ApiError &&
    query.error.errorCode === "NOT_AN_EMPLOYEE"
  )
    return null;

  const metricCards = [
    {
      label: "Latest Net Take-Home",
      value: money(summary.latestNet),
      subtext: summary.latestPeriod,
      Icon: Wallet,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Average Take-Home",
      value: money(summary.avgNet),
      subtext: "Per payroll cycle",
      Icon: Coins,
      color: "text-brand-500 bg-sky-50 dark:bg-sky-950/40",
    },
    {
      label: "Total Salary Slips",
      value: summary.totalSlips.toString(),
      subtext: "Archived records",
      Icon: FileText,
      color: "text-slate-600 bg-slate-100 dark:bg-slate-800",
    },
    {
      label: "Latest Pay Period",
      value: summary.latestPeriod,
      subtext: "Most recent payout",
      Icon: Calendar,
      color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40",
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-reveal pb-12">
      {/* 1. Page Header with 3D Payroll Hero */}
      <HrPageHeader
        title="My Payslips"
        description="View official salary slips, detailed compensation breakdowns, and download monthly PDF records."
        icon3d="payroll"
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
            aria-label="Search payslips"
            placeholder="Search by slip # or period..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchQuery ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-red-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear search</span>
          </Button>
        ) : null}
      </div>

      <QueryState query={query} area="your payslips" />

      {query.isSuccess && rows.length === 0 ? (
        <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title="No payslips yet"
            description="Your payslip appears here once a payroll period is finalized."
          />
        </div>
      ) : null}

      {query.isSuccess && rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-white shadow-xs dark:border-slate-700/80 dark:bg-slate-900">
          <DataTable<Payslip>
            className="border-0 shadow-none rounded-none"
            caption="My payslips"
            rows={filteredRows}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Payslip #",
                cell: (r) => (
                  <span className="font-bold text-[#0a3271] dark:text-white">
                    {r.payslipNumber}
                  </span>
                ),
              },
              {
                header: "Payroll Period",
                cell: (r) => (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                    <Calendar className="h-3.5 w-3.5 text-brand-500" />
                    <span>{periodLabel(r.payrollPeriod)}</span>
                  </div>
                ),
              },
              {
                header: "Net Take-Home",
                cell: (r) => (
                  <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                    {money(r.netPayable)}
                  </span>
                ),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Issued Date",
                cell: (r) => (
                  <span className="text-theme-xs font-medium text-slate-500">
                    {isoDate(r.generatedAt)}
                    {r.version && r.version > 1 ? (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        v{r.version}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                header: "Actions",
                className: "text-right",
                cell: (r) => (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`View payslip ${r.payslipNumber}`}
                      onClick={() => setOpen(r)}
                      className="text-xs font-semibold hover:border-brand-300 hover:text-brand-600"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      View Slip
                    </Button>
                    <DownloadPdfButton payslip={r} selfService={true} />
                  </div>
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
        <PayslipDocumentDialog
          payslip={open}
          selfService={true}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

/** HR Organization Payslips Hub (with CSV & Excel exports, single-baseline filters) */
function HrPayslipsSection() {
  const canRead = usePermission(PAYSLIP_READ);
  const canGenerate = usePermission(PAYROLL_WRITE);
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [open, setOpen] = useState<Payslip | null>(null);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState<Payslip | null>(null);

  // Summary query to compute KPIs
  const summaryQuery = usePayslips(
    {
      page: 1,
      limit: 100,
      ...(periodId ? { payrollPeriodId: periodId } : {}),
    },
    canRead,
  );
  const allPayslips = summaryQuery.data?.data ?? [];

  // Filtered queries
  const query = usePayslips(
    {
      page,
      limit: PAGE_SIZE,
      ...(periodId ? { payrollPeriodId: periodId } : {}),
    },
    canRead,
  );
  const rawRows = query.data?.data ?? [];

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    allPayslips.forEach((p) => {
      const dept =
        p.employee.department?.name || p.employee.team?.name || "General";
      if (dept) set.add(dept);
    });
    return Array.from(set).sort();
  }, [allPayslips]);

  // Client-side search and department filtering
  const filteredRows = useMemo(() => {
    let result = rawRows;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) => {
        const name = p.employee.fullName.toLowerCase();
        const code = p.employee.employeeCode.toLowerCase();
        const slip = p.payslipNumber.toLowerCase();
        const dept = (
          p.employee.department?.name ||
          p.employee.team?.name ||
          ""
        ).toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          slip.includes(q) ||
          dept.includes(q)
        );
      });
    }

    if (departmentFilter) {
      result = result.filter((p) => {
        const dept =
          p.employee.department?.name || p.employee.team?.name || "General";
        return dept === departmentFilter;
      });
    }

    return result;
  }, [rawRows, search, departmentFilter]);

  // Active period title for export naming
  const activePeriodTitle = useMemo(() => {
    if (periodId && allPayslips[0]) {
      return periodLabel(allPayslips[0].payrollPeriod);
    }
    return "All_Periods";
  }, [periodId, allPayslips]);

  // KPI Metrics Calculation
  const {
    totalSlipsCount,
    totalNetPayout,
    totalDeductionsAmount,
    avgNetSalary,
  } = useMemo(() => {
    const totalSlips = allPayslips.length;
    let netSum = 0;
    let deductionsSum = 0;

    allPayslips.forEach((p) => {
      netSum += Number(p.netPayable || 0);
      deductionsSum += Number(p.payrollEntry.totalDeductions || 0);
    });

    const avg = totalSlips > 0 ? netSum / totalSlips : 0;

    return {
      totalSlipsCount: totalSlips,
      totalNetPayout: netSum,
      totalDeductionsAmount: deductionsSum,
      avgNetSalary: avg,
    };
  }, [allPayslips]);

  const hasFilters =
    search !== "" || departmentFilter !== "" || periodId !== null;

  const handleClearFilters = () => {
    setSearch("");
    setDepartmentFilter("");
    setPeriodId(null);
    setPage(1);
  };

  const handleExportCsv = () => {
    if (allPayslips.length === 0) {
      toast({ title: "No payslips available to export", variant: "warning" });
      return;
    }
    exportPayslipsCsv(allPayslips, activePeriodTitle);
    setExportOpen(false);
    toast({ title: "CSV export generated successfully", variant: "success" });
  };

  const handleExportExcel = () => {
    if (allPayslips.length === 0) {
      toast({ title: "No payslips available to export", variant: "warning" });
      return;
    }
    exportPayslipsExcel(allPayslips, activePeriodTitle);
    setExportOpen(false);
    toast({
      title: "Excel (.xls) export generated successfully",
      variant: "success",
    });
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
              Employee Payslips & Disbursals
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Official monthly salary slips, statutory deductions, bank credit
              advice, and bulk spreadsheet exports.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canGenerate && (
              <Button
                onClick={() => setGenerating(true)}
                className="bg-[#1769F5] hover:bg-[#1258d4] text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-transform hover:scale-102"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Generate Payslips
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4 Interactive KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Payslips Issued */}
        <button
          type="button"
          onClick={handleClearFilters}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            !hasFilters
              ? "border-2 border-brand-500 bg-sky-50/50 shadow-md ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                Total Payslips
              </p>
              {!hasFilters ? (
                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                  All
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalSlipsCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Generated in scope
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 transition-transform group-hover:scale-105 dark:border-slate-700 dark:bg-slate-800">
            <FileText className="h-5 w-5" />
          </div>
        </button>

        {/* Total Net Payout */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/90 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Total Net Disbursed
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {money(totalNetPayout)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Credited to employees
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {/* Total Deductions */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/90 bg-white p-4 shadow-2xs dark:border-amber-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Total Deductions
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {money(totalDeductionsAmount)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              PF, ESI, TDS & Loan EMIs
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        {/* Average Net Take-Home */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              Avg Net Take-Home
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {money(avgNetSalary)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Per employee average
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Unified Single-Baseline Filter Toolbar (Fixing Alignment) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-70">
          {/* Live Search */}
          <div className="relative flex-1 min-w-55">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by employee name, code, or slip #..."
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

          {/* Period Selector */}
          <div className="w-full sm:w-48">
            <PeriodFilterSelect
              value={periodId}
              onChange={(id) => {
                setPeriodId(id);
                setPage(1);
              }}
            />
          </div>

          {/* Department Filter */}
          <Select
            aria-label="Filter by department"
            className="w-full sm:w-44"
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

        {/* Action Buttons: Export CSV / Excel & Generate */}
        <div className="flex items-center gap-2 relative">
          {/* Export Dropdown Menu */}
          <div className="relative">
            <Button
              variant="secondary"
              onClick={() => setExportOpen((prev) => !prev)}
              disabled={allPayslips.length === 0}
              className="border-sky-200 hover:border-brand-400 text-slate-700 dark:text-slate-200 font-semibold"
            >
              <Download className="mr-1.5 h-4 w-4 text-brand-500" />
              Export
              <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
            </Button>

            {exportOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setExportOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-sky-100 bg-white py-1.5 shadow-xl ring-1 ring-black/5 z-50 dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-brand-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-4 w-4 text-brand-500" />
                    Export CSV (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-emerald-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Export Excel (.xls)
                  </button>
                </div>
              </>
            )}
          </div>

          {canGenerate && (
            <Button
              onClick={() => setGenerating(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white font-bold"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Generate
            </Button>
          )}
        </div>
      </div>

      {/* Main Payslips Directory Table */}
      <div className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        {filteredRows.length === 0 ? (
          <EmptyState
            title="No Payslips Found"
            description={
              hasFilters
                ? "No payslips match your search or filter criteria. Try adjusting or resetting filters."
                : "Payslips are issued when a payroll period is finalized."
            }
          />
        ) : (
          <>
            <DataTable<Payslip>
              caption="Employee Payslips"
              rows={filteredRows}
              getRowKey={(r) => String(r.id)}
              columns={[
                {
                  header: "Slip #",
                  cell: (r) => (
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {r.payslipNumber}
                    </span>
                  ),
                },
                {
                  header: "Employee",
                  cell: (r) => (
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {r.employee.fullName}
                      </span>
                      <span className="text-theme-xs text-gray-500">
                        {r.employee.employeeCode}
                      </span>
                    </div>
                  ),
                },
                {
                  header: "Department",
                  cell: (r) =>
                    r.employee.department?.name ||
                    r.employee.team?.name ||
                    "General",
                },
                {
                  header: "Period",
                  cell: (r) => periodLabel(r.payrollPeriod),
                },
                {
                  header: "Gross Earnings",
                  cell: (r) => (
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {money(r.payrollEntry.totalGrossEarnings)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Deductions",
                  cell: (r) => (
                    <span className="font-medium text-rose-600 dark:text-rose-400">
                      {money(r.payrollEntry.totalDeductions)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Net Take-Home",
                  cell: (r) => (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {money(r.netPayable)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Issued / Version",
                  cell: (r) => (
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-theme-xs text-gray-500">
                        {isoDate(r.generatedAt)}
                      </span>
                      {r.version && r.version > 1 ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          v{r.version} (Regenerated)
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  header: "Actions",
                  cell: (r) => (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`View payslip ${r.payslipNumber}`}
                        onClick={() => setOpen(r)}
                        className="text-xs font-semibold"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                      <DownloadPdfButton payslip={r} selfService={false} />
                      {canGenerate ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Regenerate payslip ${r.payslipNumber}`}
                          onClick={() => setRegenerating(r)}
                          className="text-xs font-semibold text-slate-500 hover:text-brand-600"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
            <div className="mt-4">
              <Pagination
                page={page}
                totalPages={query.data?.meta?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Dialogs */}
      {open ? (
        <PayslipDocumentDialog
          payslip={open}
          selfService={false}
          onClose={() => setOpen(null)}
        />
      ) : null}

      {generating ? (
        <GeneratePayslipsDialog onClose={() => setGenerating(false)} />
      ) : null}

      {regenerating ? (
        <RegeneratePayslipDialog
          payslip={regenerating}
          onClose={() => setRegenerating(null)}
        />
      ) : null}
    </div>
  );
}

/** HR → Payroll → Payslips: Main Component with View Mode Switcher */
export function PayslipsPanel() {
  const canReadMy = usePermission(MY_PAYSLIP_READ);
  const canReadHr = usePermission(PAYSLIP_READ);
  const [activeTab, setActiveTab] = useState<"hr" | "my">(
    canReadHr ? "hr" : "my",
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Top Segmented Mode Switcher */}
      {canReadHr && canReadMy && (
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
            Organization Payslips
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
            My Payslips
          </button>
        </div>
      )}

      {activeTab === "hr" && canReadHr && <HrPayslipsSection />}
      {activeTab === "my" && canReadMy && <MyPayslipsSection />}
    </div>
  );
}
