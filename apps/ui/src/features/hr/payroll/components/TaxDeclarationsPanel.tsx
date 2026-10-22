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
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
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
import { useAuthStore } from "@/stores/auth-store";
import {
  describeError,
  money,
  recentFinancialYears,
  timestamp,
} from "../format";
import {
  useSaveDeclarationForEmployee,
  useTaxDeclarations,
  useVerifyDeclaration,
} from "../hooks";
import {
  TAX_DECLARATION_APPROVE,
  TAX_DECLARATION_READ,
  TAX_DECLARATION_WRITE,
} from "../permissions";
import {
  DECLARATION_FIELDS,
  DECLARATION_STATUSES,
  type DeclarationStatus,
  type TaxDeclaration,
  VERIFIABLE_FIELDS,
  type VerifiedField,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { StatusPill, statusLabel } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";
import {
  DeclarationFields,
  declarationAmounts,
  declarationDraft,
  Form16View,
} from "./TaxDeclarationParts";
import { TaxSlabsGuideDialog } from "./TaxSlabsGuideDialog";
import {
  exportTaxDeclarationsCsv,
  exportTaxDeclarationsExcel,
} from "./tax-declaration-export";

const PAGE_SIZE = 15;

// ============================================================================
// 1. Verify Dialog (HR Checks Submitted Declarations against Proofs)
// ============================================================================

function VerifyDialog({
  declaration: d,
  onClose,
}: {
  declaration: TaxDeclaration;
  onClose: () => void;
}) {
  const verify = useVerifyDeclaration();
  const { toast } = useToast();

  const [accepted, setAccepted] = useState<Record<VerifiedField, string>>(
    () => {
      const out = {} as Record<VerifiedField, string>;
      for (const [declared, field] of VERIFIABLE_FIELDS) {
        out[field] = String(Number(d[declared]));
      }
      return out;
    },
  );

  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const label = (declared: string) =>
    DECLARATION_FIELDS.find(([k]) => k === declared)?.[1] ?? declared;

  // Quick action: accept all declared values with one click
  function handleAcceptAllDeclared() {
    const out = {} as Record<VerifiedField, string>;
    for (const [declared, field] of VERIFIABLE_FIELDS) {
      out[field] = String(Number(d[declared]));
    }
    setAccepted(out);
  }

  async function run(decision: "VERIFIED" | "REJECTED") {
    if (decision === "REJECTED" && note.trim().length < 3) {
      setError(
        "Please provide a note explaining the rejection (at least 3 characters).",
      );
      return;
    }
    const body: Partial<Record<VerifiedField, number>> = {};
    for (const [, field] of VERIFIABLE_FIELDS) {
      const n = Number(accepted[field]);
      if (!Number.isFinite(n) || n < 0) {
        setError("Accepted amounts must be ₹0 or more");
        return;
      }
      body[field] = n;
    }
    setError(null);
    try {
      await verify.mutateAsync({
        id: d.id,
        body: {
          decision,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(decision === "VERIFIED" ? body : {}),
        },
      });
      toast({
        title:
          decision === "VERIFIED"
            ? `Declaration for ${d.employee.fullName} verified`
            : `Declaration rejected`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Verify Tax Declaration: ${d.employee.fullName} (FY ${d.financialYear})`}
      size="3xl"
    >
      <div className="flex flex-col gap-5 p-1">
        {/* Employee & Regime Overview */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {d.employee.fullName}
              </span>
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-slate-700 dark:text-sky-300">
                {d.regime === "NEW" ? "New Regime" : "Old Regime"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Employee Code: {d.employee.employeeCode} · Submitted on{" "}
              {timestamp(d.submittedAt)}
            </p>
          </div>

          <div className="text-right text-xs">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Other Income: {money(d.otherIncome)}
            </p>
            <p className="text-slate-500">
              Prev Employer: {money(d.previousEmployerIncome)} (TDS{" "}
              {money(d.previousEmployerTds)})
            </p>
          </div>
        </div>

        {/* Verification Controls Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
            Deductions Proof Audit
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAcceptAllDeclared}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Accept All Declared
          </Button>
        </div>

        {/* Verifiable Fields Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {VERIFIABLE_FIELDS.map(([declared, field]) => {
            const decAmount = money(d[declared]);
            return (
              <div
                key={field}
                className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {label(declared)}
                  </span>
                  <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
                    Declared: {decAmount}
                  </span>
                </div>
                <FormField label="Accepted Amount (₹)">
                  {(f) => (
                    <Input
                      {...f}
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={accepted[field]}
                      onChange={(e) =>
                        setAccepted((a) => ({ ...a, [field]: e.target.value }))
                      }
                      className="bg-white dark:bg-slate-800"
                    />
                  )}
                </FormField>
              </div>
            );
          })}
        </div>

        {/* Verification Note */}
        <FormField
          label="Verification / Audit Note"
          hint="Required if rejecting, optional if verifying."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              placeholder="e.g. Verified against LIC premium receipts and rent agreement."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>

        <ServerError message={error} />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-slate-800">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={verify.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={verify.isPending}
            onClick={() => void run("REJECTED")}
            className="text-xs font-bold"
          >
            Reject Declaration
          </Button>
          <Button
            loading={verify.isPending}
            onClick={() => void run("VERIFIED")}
            className="bg-brand-500 hover:bg-brand-600 font-bold text-white text-xs shadow-xs"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Verify Declaration
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ============================================================================
// 2. Declaration on Behalf Dialog
// ============================================================================

function OnBehalfDialog({
  financialYear,
  existing,
  onClose,
}: {
  financialYear: string;
  existing: TaxDeclaration | null;
  onClose: () => void;
}) {
  const save = useSaveDeclarationForEmployee();
  const { toast } = useToast();

  const [employee, setEmployee] = useState<EmployeeOption | null>(
    existing
      ? ({
          id: existing.employee.id,
          fullName: existing.employee.fullName,
          employeeCode: existing.employee.employeeCode,
        } as EmployeeOption)
      : null,
  );

  const [draft, setDraft] = useState(() => declarationDraft(existing));
  const [submit, setSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return setError("Please select an employee");
    const parsed = declarationAmounts(draft);
    if ("error" in parsed) return setError(parsed.error);
    setError(null);

    try {
      await save.mutateAsync({
        employeeId: employee.id,
        financialYear,
        body: {
          version: existing?.version ?? 0,
          regime: draft.regime,
          ...parsed.amounts,
          submit,
        },
      });
      toast({
        title: submit
          ? `Declaration submitted for ${employee.fullName}`
          : `Declaration draft saved for ${employee.fullName}`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        existing
          ? `Edit Tax Declaration: ${existing.employee.fullName} (FY ${financialYear})`
          : `Tax Declaration on Behalf — FY ${financialYear}`
      }
      size="4xl"
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 p-1"
        noValidate
      >
        {/* Employee Selection */}
        <FormField label="Employee" required>
          {(f) => (
            <EmployeePicker
              {...f}
              value={employee}
              onChange={setEmployee}
              disabled={Boolean(existing)}
            />
          )}
        </FormField>

        {/* Enhanced Regime-aware fields */}
        <DeclarationFields draft={draft} onChange={setDraft} />

        {/* Submit Toggle */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={submit}
              onChange={(e) => setSubmit(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              Submit immediately for HR verification (otherwise stored as an
              editable draft)
            </span>
          </label>
        </div>

        <ServerError message={error} />

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={save.isPending}
            className="bg-brand-500 hover:bg-brand-600 font-bold text-white text-xs shadow-xs"
          >
            {submit ? "Submit Declaration" : "Save Draft"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ============================================================================
// 3. Form 16 Modal Dialog
// ============================================================================

function Form16Dialog({
  financialYear,
  employee,
  onClose,
}: {
  financialYear: string;
  employee: { id: number; fullName: string };
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Form 16 (Part B) — ${employee.fullName} · FY ${financialYear}`}
      size="4xl"
    >
      <div className="flex flex-col gap-4 p-1">
        <Form16View financialYear={financialYear} employeeId={employee.id} />
        <div className="flex justify-end border-t border-gray-100 pt-3 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ============================================================================
// 4. Main Tax Declarations Panel
// ============================================================================

export function TaxDeclarationsPanel() {
  const canRead = usePermission(TAX_DECLARATION_READ);
  const canWrite = usePermission(TAX_DECLARATION_WRITE);
  const canApprove = usePermission(TAX_DECLARATION_APPROVE);
  const userId = useAuthStore((s) => s.user?.userId ?? null);

  const years = recentFinancialYears(4);
  const [financialYear, setFinancialYear] = useState(years[0] ?? "");
  const [status, setStatus] = useState<DeclarationStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Dialog states
  const [verifying, setVerifying] = useState<TaxDeclaration | null>(null);
  const [onBehalf, setOnBehalf] = useState<{
    existing: TaxDeclaration | null;
  } | null>(null);
  const [form16Employee, setForm16Employee] = useState<{
    id: number;
    fullName: string;
  } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Query tax declarations
  const query = useTaxDeclarations(
    {
      page,
      limit: PAGE_SIZE,
      financialYear,
      ...(status ? { status } : {}),
    },
    canRead,
  );

  const allRows = query.data?.data ?? [];

  // Filter rows by live search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase().trim();
    return allRows.filter(
      (r) =>
        r.employee.fullName.toLowerCase().includes(q) ||
        r.employee.employeeCode.toLowerCase().includes(q),
    );
  }, [allRows, search]);

  // Aggregate KPI summary metrics across fetched declarations
  const {
    totalDeclarations,
    pendingCount,
    newRegimeRatio,
    newRegimeCount,
    verifiedCount,
  } = useMemo(() => {
    let pending = 0;
    let newRegime = 0;
    let verified = 0;

    allRows.forEach((r) => {
      if (r.status === "SUBMITTED") pending++;
      if (r.status === "VERIFIED") verified++;
      if (r.regime === "NEW") newRegime++;
    });

    const total = allRows.length;
    const ratio = total > 0 ? Math.round((newRegime / total) * 100) : 0;

    return {
      totalDeclarations: total,
      pendingCount: pending,
      newRegimeRatio: ratio,
      newRegimeCount: newRegime,
      verifiedCount: verified,
    };
  }, [allRows]);

  const hasFilters = Boolean(status || search.trim());

  function handleClearFilters() {
    setStatus("");
    setSearch("");
    setPage(1);
  }

  function handleExportCsv() {
    exportTaxDeclarationsCsv(filteredRows, financialYear);
    setExportOpen(false);
  }

  function handleExportExcel() {
    exportTaxDeclarationsExcel(filteredRows, financialYear);
    setExportOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-linear-to-r from-sky-50/80 via-white to-blue-50/60 p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                Tax Declarations & TDS Compliance
              </h2>
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
                FY {financialYear}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage employee investment declarations, verify Chapter VI-A
              deductions, and issue Form 16 Part B certificates.
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 relative">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setGuideOpen(true)}
            className="border-sky-200 text-xs font-semibold text-slate-700 hover:border-brand-400 dark:text-slate-200"
          >
            <HelpCircle className="mr-1.5 h-3.5 w-3.5 text-brand-500" />
            Tax Slabs Guide
          </Button>

          {/* Export Dropdown */}
          <div className="relative">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setExportOpen((prev) => !prev)}
              disabled={allRows.length === 0}
              className="border-sky-200 text-xs font-semibold text-slate-700 hover:border-brand-400 dark:text-slate-200"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-brand-500" />
              Export
              <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
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
                    onClick={handleExportExcel}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-emerald-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Export Excel (.xls)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-brand-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-4 w-4 text-brand-500" />
                    Export CSV (.csv)
                  </button>
                </div>
              </>
            )}
          </div>

          {canWrite && (
            <Button
              size="sm"
              onClick={() => setOnBehalf({ existing: null })}
              className="bg-brand-500 hover:bg-brand-600 font-bold text-white text-xs shadow-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Declaration on Behalf
            </Button>
          )}
        </div>
      </div>

      {/* 2. 4 Interactive Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Declarations */}
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
                Total Declarations
              </p>
              {!hasFilters && (
                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                  All
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalDeclarations}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Recorded in FY {financialYear}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <FileText className="h-5 w-5" />
          </div>
        </button>

        {/* Pending Verification */}
        <button
          type="button"
          onClick={() => {
            setStatus("SUBMITTED");
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            status === "SUBMITTED"
              ? "border-2 border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20 dark:border-amber-400 dark:bg-slate-800"
              : "border border-amber-200/90 bg-white shadow-2xs hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pending Review
              </p>
              {status === "SUBMITTED" && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-slate-800 dark:text-amber-300">
                  Active
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {pendingCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Awaiting HR proof audit
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40">
            <Clock className="h-5 w-5" />
          </div>
        </button>

        {/* New Regime Ratio */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              New Regime Ratio
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {newRegimeRatio}%
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {newRegimeCount} opting for Sec 115BAC
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Verified & Approved */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/90 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Verified & Locked
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {verifiedCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Ready for payroll TDS runs
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Unified Single-Baseline Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-70">
          {/* Live Search */}
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee by name or code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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

          {/* Financial Year Selector */}
          <div className="w-full sm:w-40">
            <Select
              aria-label="Filter by financial year"
              value={financialYear}
              onChange={(e) => {
                setFinancialYear(e.target.value);
                setPage(1);
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  FY {y}
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by declaration status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as DeclarationStatus | "");
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              {DECLARATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
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

      <QueryState query={query} area="tax declarations" />

      {/* 4. Main Tax Declarations Directory Table */}
      <div className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        {filteredRows.length === 0 ? (
          <EmptyState
            title="No Tax Declarations Found"
            description={
              hasFilters
                ? "No employee declarations match your search or filter criteria. Try resetting filters."
                : status === "SUBMITTED"
                  ? "All submitted declarations have been audited and verified."
                  : `No declarations have been recorded yet for FY ${financialYear}. Use "Declaration on behalf" to record one.`
            }
          />
        ) : (
          <>
            <DataTable<TaxDeclaration>
              caption="Tax Declarations Directory"
              rows={filteredRows}
              getRowKey={(r) => String(r.id)}
              columns={[
                {
                  header: "Employee",
                  cell: (r) => (
                    <div className="flex items-center gap-2.5 py-0.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 font-bold text-xs text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                        {r.employee.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {r.employee.fullName}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {r.employee.employeeCode}
                        </span>
                      </div>
                    </div>
                  ),
                },
                {
                  header: "Regime",
                  cell: (r) => (
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ${
                        r.regime === "NEW"
                          ? "bg-sky-50 text-brand-700 dark:bg-slate-800 dark:text-sky-300 border border-sky-200/80 dark:border-slate-700"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {r.regime === "NEW" ? "New Regime" : "Old Regime"}
                    </span>
                  ),
                },
                {
                  header: "Declared Deductions",
                  cell: (r) => (
                    <div className="flex flex-col text-xs">
                      {r.regime === "NEW" ? (
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          Standard: ₹75,000
                        </span>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            80C: {money(r.section80c)} · 80D:{" "}
                            {money(r.section80d)}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            HRA: {money(r.hraExemption)} · Home:{" "}
                            {money(r.homeLoanInterest)}
                          </span>
                        </>
                      )}
                    </div>
                  ),
                },
                {
                  header: "Status & Verifier",
                  cell: (r) => (
                    <div className="flex flex-col items-start gap-0.5">
                      <StatusPill status={r.status} />
                      {r.verifier && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          by {r.verifier.fullName} · {timestamp(r.verifiedAt)}
                        </span>
                      )}
                      {r.verificationNote && (
                        <span className="text-[11px] text-slate-400 italic line-clamp-1 max-w-50">
                          &ldquo;{r.verificationNote}&rdquo;
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  header: "Actions",
                  cell: (r) => (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {canApprove && r.status === "SUBMITTED" ? (
                        r.employee.userId === userId ? (
                          <span className="text-[11px] text-slate-500 italic">
                            Self (Other verifier required)
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setVerifying(r)}
                            className="bg-brand-500 hover:bg-brand-600 font-bold text-white text-xs shadow-xs"
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Verify
                          </Button>
                        )
                      ) : null}

                      {canWrite &&
                      (r.status === "DRAFT" || r.status === "REJECTED") ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setOnBehalf({ existing: r })}
                          className="text-xs font-semibold"
                        >
                          Edit
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setForm16Employee({
                            id: r.employee.id,
                            fullName: r.employee.fullName,
                          })
                        }
                        className="text-xs font-semibold text-slate-600 hover:text-brand-600 dark:text-slate-300"
                      >
                        <FileText className="mr-1 h-3.5 w-3.5 text-brand-500" />
                        Form 16
                      </Button>
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

      {/* Dialogs */}
      {verifying && (
        <VerifyDialog
          declaration={verifying}
          onClose={() => setVerifying(null)}
        />
      )}

      {onBehalf && (
        <OnBehalfDialog
          financialYear={financialYear}
          existing={onBehalf.existing}
          onClose={() => setOnBehalf(null)}
        />
      )}

      {form16Employee && (
        <Form16Dialog
          financialYear={financialYear}
          employee={form16Employee}
          onClose={() => setForm16Employee(null)}
        />
      )}

      {guideOpen && <TaxSlabsGuideDialog onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
