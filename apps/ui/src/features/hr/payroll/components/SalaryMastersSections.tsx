"use client";

import {
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  ArrowUpDown,
  Calculator,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Edit3,
  Filter,
  Info,
  Layers,
  Lock,
  Percent,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import type { TemplateLineBody } from "../api";
import { describeError, money } from "../format";
import {
  useSalaryComponents,
  useSalaryTemplates,
  useSaveSalaryComponent,
  useSaveSalaryTemplate,
  useTemplatePreview,
} from "../hooks";
import { PAYROLL_SETTINGS_WRITE } from "../permissions";
import {
  CALCULATION_TYPES,
  type CalculationType,
  type ComponentKind,
  type SalaryComponent,
  type SalaryTemplate,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { StatusPill } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

const FLAG_LABEL = {
  isProrated: "Reduced for loss of pay",
  isTaxable: "Taxable (TDS)",
  pfApplicable: "Part of the PF wage",
  esiApplicable: "Part of the ESI wage",
} as const;
type Flag = keyof typeof FLAG_LABEL;

const CALC_LABEL: Record<CalculationType, string> = {
  FIXED: "Fixed ₹",
  PERCENT_OF_GROSS: "% of gross",
  PERCENT_OF_BASIC: "% of Basic",
  REMAINDER: "Remainder of gross",
};

function CheckLine({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-theme-sm text-gray-700 dark:text-gray-300">
      <Checkbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

// ---- components -------------------------------------------------------------

function ComponentDialog({
  component,
  onClose,
}: {
  component: SalaryComponent | null;
  onClose: () => void;
}) {
  const save = useSaveSalaryComponent();
  const { toast } = useToast();
  const [code, setCode] = useState(component?.code ?? "");
  const [name, setName] = useState(component?.name ?? "");
  const [kind, setKind] = useState<ComponentKind>(component?.kind ?? "EARNING");
  const [order, setOrder] = useState(String(component?.displayOrder ?? 100));
  const [flags, setFlags] = useState<Record<Flag, boolean>>({
    isProrated: component?.isProrated ?? true,
    isTaxable: component?.isTaxable ?? true,
    pfApplicable: component?.pfApplicable ?? false,
    esiApplicable: component?.esiApplicable ?? true,
  });
  const [active, setActive] = useState(component?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!component && !/^[A-Z][A-Z0-9_]{1,39}$/.test(code.trim().toUpperCase()))
      next.code =
        "Upper-case letters, digits and _ (2–40), starting with a letter";
    if (name.trim().length < 2)
      next.name = "Enter a descriptive name (at least 2 characters)";
    if (!Number.isInteger(Number(order)) || Number(order) < 0)
      next.order = "Enter a valid positive number";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setServerError(null);
    try {
      await save.mutateAsync({
        id: component?.id ?? null,
        body: {
          ...(component
            ? { isActive: active }
            : { code: code.trim().toUpperCase(), kind }),
          name: name.trim(),
          displayOrder: Number(order),
          ...flags,
        },
      });
      toast({
        title: component ? "Component updated" : "Component added",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={component ? `Edit ${component.name}` : "New Salary Component"}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {/* Header Summary Banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-brand-600 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0a3271] dark:text-white">
              {component
                ? `Configure ${component.name}`
                : "Define Salary Component"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Set component classification, display order, and statutory
              compliance behavior.
            </p>
          </div>
        </div>

        {/* Kind Selection (Segmented Cards for New, Locked Banner for Existing) */}
        {!component ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Component Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setKind("EARNING")}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                  kind === "EARNING"
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/30"
                    : "border-gray-200 hover:border-gray-300 bg-white dark:border-slate-800 dark:bg-slate-900/50"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Earning / Allowance
                    </span>
                    {kind === "EARNING" && (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Adds to gross pay (Basic, HRA, DA, Special Allowances).
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setKind("DEDUCTION")}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                  kind === "DEDUCTION"
                    ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20 dark:border-amber-500 dark:bg-amber-950/30"
                    : "border-gray-200 hover:border-gray-300 bg-white dark:border-slate-800 dark:bg-slate-900/50"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Deduction / Recovery
                    </span>
                    {kind === "DEDUCTION" && (
                      <Check className="h-3.5 w-3.5 text-amber-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Subtracted from gross (PF, ESI, TDS, PT, Loan Deductions).
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-sky-100 bg-sky-50/40 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center gap-2.5">
              {component.kind === "EARNING" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Earning / Allowance
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Deduction / Recovery
                </span>
              )}
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Kind is permanent
              </span>
            </div>
            {component.isSystem && (
              <span className="text-[11px] font-bold text-slate-600 bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md">
                System Master
              </span>
            )}
          </div>
        )}

        {/* Input Fields Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Component Code"
            required
            hint={
              component
                ? "Permanent master identifier"
                : "Upper-case identifier e.g. SHIFT_ALLOWANCE"
            }
            error={errors.code}
          >
            {(f) => (
              <div className="relative">
                <Input
                  {...f}
                  disabled={Boolean(component)}
                  placeholder="e.g. SPECIAL_ALLOWANCE"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                    )
                  }
                  className={
                    component
                      ? "bg-gray-100 font-semibold text-gray-700 dark:bg-slate-800"
                      : "font-semibold"
                  }
                />
                {component && (
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                )}
              </div>
            )}
          </FormField>

          <FormField
            label="Component Display Name"
            required
            error={errors.name}
          >
            {(f) => (
              <Input
                {...f}
                placeholder="e.g. Special Allowance"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </FormField>

          <FormField
            label="Payslip Display Order"
            hint="Sort order in payslips and reports (lower numbers appear first)"
            error={errors.order}
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={1}
                step={10}
                placeholder="100"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            )}
          </FormField>

          {component ? (
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/60 cursor-pointer dark:border-slate-800 dark:bg-slate-900/40">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Active Component
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Usable in salary templates & active contracts.
                  </p>
                </div>
              </label>
            </div>
          ) : null}
        </div>

        {/* 4 Interactive Statutory & Payroll Treatment Cards */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#0a3271] dark:text-sky-300 uppercase tracking-wider">
              Statutory & Payroll Calculation Treatment
            </label>
            <span className="text-[11px] text-slate-500">
              Indian compliance behavior
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* LOP Prorated */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                flags.isProrated
                  ? "border-sky-300 bg-sky-50/60 dark:border-sky-700 dark:bg-sky-950/30"
                  : "border-gray-200 hover:border-gray-300 bg-white dark:border-slate-800 dark:bg-slate-900/50"
              }`}
            >
              <input
                type="checkbox"
                checked={flags.isProrated}
                onChange={(e) =>
                  setFlags((f) => ({ ...f, isProrated: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-sky-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    LOP Attendance Proration
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Prorate proportionally based on attendance days and unpaid
                  absence (loss of pay).
                </p>
              </div>
            </label>

            {/* Taxable TDS */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                flags.isTaxable
                  ? "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30"
                  : "border-gray-200 hover:border-gray-300 bg-white dark:border-slate-800 dark:bg-slate-900/50"
              }`}
            >
              <input
                type="checkbox"
                checked={flags.isTaxable}
                onChange={(e) =>
                  setFlags((f) => ({ ...f, isTaxable: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Taxable under TDS (Sec 17)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Include in employee taxable gross income for monthly TDS
                  income tax deduction.
                </p>
              </div>
            </label>

            {/* PF Wage */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                flags.pfApplicable
                  ? "border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/30"
                  : "border-gray-200 hover:border-gray-300 bg-white dark:border-slate-800 dark:bg-slate-900/50"
              }`}
            >
              <input
                type="checkbox"
                checked={flags.pfApplicable}
                onChange={(e) =>
                  setFlags((f) => ({ ...f, pfApplicable: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Part of PF Wage Base
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Included in basic wages for statutory Provident Fund (EPF)
                  computation.
                </p>
              </div>
            </label>

            {/* ESI Wage */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                flags.esiApplicable
                  ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30"
                  : "border-gray-200 hover:border-gray-300 bg-white dark:border-slate-800 dark:bg-slate-900/50"
              }`}
            >
              <input
                type="checkbox"
                checked={flags.esiApplicable}
                onChange={(e) =>
                  setFlags((f) => ({ ...f, esiApplicable: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Part of ESI Wage Base
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Included in monthly gross wage for ESI contribution threshold
                  & computation.
                </p>
              </div>
            </label>
          </div>
        </div>

        <ServerError message={serverError} />

        <DialogActions
          onCancel={onClose}
          submitting={save.isPending}
          submitLabel={component ? "Save Changes" : "Create Component"}
        />
      </form>
    </Dialog>
  );
}

/** The salary component master (Docs/PAYROLL_AND_COMPLIANCE.md §3.0). */
export function ComponentsSection() {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const [editing, setEditing] = useState<SalaryComponent | "new" | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | "EARNING" | "DEDUCTION">(
    "ALL",
  );
  const [treatmentFilter, setTreatmentFilter] = useState<
    "ALL" | "STATUTORY" | "TAXABLE" | "PF" | "ESI" | "PRORATED"
  >("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ACTIVE" | "ALL" | "INACTIVE"
  >("ACTIVE");

  // Query all components (active & inactive) to power KPIs and client filtering
  const query = useSalaryComponents(true);
  const allRows = query.data ?? [];

  // Top KPI Metrics
  const totalCount = allRows.length;
  const activeCount = allRows.filter((r) => r.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const earningsCount = allRows.filter((r) => r.kind === "EARNING").length;
  const deductionsCount = allRows.filter((r) => r.kind === "DEDUCTION").length;
  const statutoryCount = allRows.filter(
    (r) => r.isTaxable || r.pfApplicable || r.esiApplicable,
  ).length;

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      // Status filter
      if (statusFilter === "ACTIVE" && !r.isActive) return false;
      if (statusFilter === "INACTIVE" && r.isActive) return false;

      // Kind filter
      if (kindFilter !== "ALL" && r.kind !== kindFilter) return false;

      // Treatment filter
      if (
        treatmentFilter === "STATUTORY" &&
        !r.isTaxable &&
        !r.pfApplicable &&
        !r.esiApplicable
      )
        return false;
      if (treatmentFilter === "TAXABLE" && !r.isTaxable) return false;
      if (treatmentFilter === "PF" && !r.pfApplicable) return false;
      if (treatmentFilter === "ESI" && !r.esiApplicable) return false;
      if (treatmentFilter === "PRORATED" && !r.isProrated) return false;

      // Search filter (name or code)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesCode = r.code.toLowerCase().includes(q);
        if (!matchesName && !matchesCode) return false;
      }

      return true;
    });
  }, [allRows, statusFilter, kindFilter, treatmentFilter, search]);

  const hasActiveFilters =
    search.trim() !== "" ||
    kindFilter !== "ALL" ||
    treatmentFilter !== "ALL" ||
    statusFilter !== "ACTIVE";

  const handleResetFilters = () => {
    setSearch("");
    setKindFilter("ALL");
    setTreatmentFilter("ALL");
    setStatusFilter("ACTIVE");
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. 4 Interactive Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Components Card */}
        <button
          type="button"
          onClick={handleResetFilters}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            !hasActiveFilters
              ? "border-2 border-brand-500 bg-sky-50/50 shadow-md ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                Total Masters
              </p>
              {!hasActiveFilters && (
                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                  All
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {activeCount} active · {inactiveCount} inactive
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Layers className="h-5 w-5" />
          </div>
        </button>

        {/* Earnings Card */}
        <button
          type="button"
          onClick={() => {
            setKindFilter("EARNING");
            setTreatmentFilter("ALL");
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            kindFilter === "EARNING"
              ? "border-2 border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-slate-800"
              : "border border-emerald-200/90 bg-white shadow-2xs hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Earnings / Allowances
              </p>
              {kindFilter === "EARNING" && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-slate-800 dark:text-emerald-300">
                  Active Filter
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {earningsCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Adds to employee gross pay
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <TrendingUp className="h-5 w-5" />
          </div>
        </button>

        {/* Deductions Card */}
        <button
          type="button"
          onClick={() => {
            setKindFilter("DEDUCTION");
            setTreatmentFilter("ALL");
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            kindFilter === "DEDUCTION"
              ? "border-2 border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20 dark:border-amber-400 dark:bg-slate-800"
              : "border border-amber-200/90 bg-white shadow-2xs hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Deductions & Recoveries
              </p>
              {kindFilter === "DEDUCTION" && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-slate-800 dark:text-amber-300">
                  Active Filter
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {deductionsCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              PF, ESI, TDS, PT & Recoveries
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40">
            <TrendingDown className="h-5 w-5" />
          </div>
        </button>

        {/* Statutory & Taxable Card */}
        <button
          type="button"
          onClick={() => {
            setTreatmentFilter("STATUTORY");
            setKindFilter("ALL");
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            treatmentFilter === "STATUTORY"
              ? "border-2 border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-slate-800"
              : "border border-blue-200/90 bg-white shadow-2xs hover:border-blue-400 hover:shadow-md dark:border-blue-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Statutory & Taxable
              </p>
              {treatmentFilter === "STATUTORY" && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-slate-800 dark:text-blue-300">
                  Active Filter
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {statutoryCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Affects PF, ESI, or TDS tax
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/40">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </button>
      </div>

      {/* 2. Unified Single-Baseline Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-70">
          {/* Live Search */}
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search component by name or code (e.g. BASIC, HRA, PF)..."
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

          {/* Kind Filter Dropdown */}
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by component kind"
              value={kindFilter}
              onChange={(e) =>
                setKindFilter(e.target.value as "ALL" | "EARNING" | "DEDUCTION")
              }
            >
              <option value="ALL">All Kinds ({totalCount})</option>
              <option value="EARNING">Earnings ({earningsCount})</option>
              <option value="DEDUCTION">Deductions ({deductionsCount})</option>
            </Select>
          </div>

          {/* Statutory / Treatment Filter Dropdown */}
          <div className="w-full sm:w-48">
            <Select
              aria-label="Filter by treatment"
              value={treatmentFilter}
              onChange={(e) =>
                setTreatmentFilter(
                  e.target.value as
                    "ALL" | "STATUTORY" | "TAXABLE" | "PF" | "ESI" | "PRORATED",
                )
              }
            >
              <option value="ALL">All Treatments</option>
              <option value="STATUTORY">Any Statutory / Taxable</option>
              <option value="TAXABLE">Taxable (TDS)</option>
              <option value="PF">Part of PF Wage</option>
              <option value="ESI">Part of ESI Wage</option>
              <option value="PRORATED">LOP Prorated</option>
            </Select>
          </div>

          {/* Status Filter Dropdown */}
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ACTIVE" | "ALL" | "INACTIVE")
              }
            >
              <option value="ACTIVE">Active Only ({activeCount})</option>
              <option value="ALL">All (Incl. Inactive)</option>
              <option value="INACTIVE">Inactive Only ({inactiveCount})</option>
            </Select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Action Button */}
        {canWrite ? (
          <Button
            onClick={() => setEditing("new")}
            className="bg-brand-500 hover:bg-[#1258d4] text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Component
          </Button>
        ) : null}
      </div>

      <QueryState query={query} area="salary components" />

      {/* 3. Filtered Table View */}
      {query.isSuccess ? (
        <DataTable<SalaryComponent>
          caption="Salary components"
          rows={filteredRows}
          getRowKey={(r) => String(r.id)}
          emptyState={
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-brand-600 dark:bg-slate-800 dark:text-sky-400">
                <Layers className="h-6 w-6" />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-800 dark:text-white">
                No matching components found
              </h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {hasActiveFilters
                  ? "Try clearing some filters to view your salary masters."
                  : "Create your first component using the New Component button above."}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-sky-400"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset all filters
                </button>
              )}
            </div>
          }
          columns={[
            {
              header: "Component",
              cell: (r) => (
                <div className="flex flex-col gap-1 py-0.5">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {r.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {r.code}
                    </span>
                    {r.isSystem ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                        <Lock className="h-2.5 w-2.5 text-slate-500" />
                        System Core
                      </span>
                    ) : (
                      <span className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-300">
                        Custom Head
                      </span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              header: "Kind",
              cell: (r) =>
                r.kind === "EARNING" ? (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    Earning
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                    Deduction
                  </span>
                ),
            },
            {
              header: "Statutory & Payroll Treatment",
              cell: (r) => {
                const chips = [];
                if (r.isProrated) {
                  chips.push(
                    <span
                      key="prorated"
                      className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                    >
                      <Clock className="h-3 w-3 text-sky-500" />
                      LOP Prorated
                    </span>,
                  );
                }
                if (r.isTaxable) {
                  chips.push(
                    <span
                      key="taxable"
                      className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      <Percent className="h-3 w-3 text-amber-500" />
                      Taxable (TDS)
                    </span>,
                  );
                }
                if (r.pfApplicable) {
                  chips.push(
                    <span
                      key="pf"
                      className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                      <ShieldCheck className="h-3 w-3 text-blue-500" />
                      PF Wage
                    </span>,
                  );
                }
                if (r.esiApplicable) {
                  chips.push(
                    <span
                      key="esi"
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ESI Wage
                    </span>,
                  );
                }
                if (chips.length === 0) {
                  return (
                    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                      Standard Flat
                    </span>
                  );
                }
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {chips}
                  </div>
                );
              },
            },
            {
              header: "Order",
              cell: (r) => (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  #{r.displayOrder}
                </span>
              ),
            },
            {
              header: "Status",
              cell: (r) => (
                <StatusPill status={r.isActive ? "ACTIVE" : "INACTIVE"} />
              ),
            },
            {
              header: "Actions",
              cell: (r) =>
                canWrite ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Edit component ${r.code}`}
                    onClick={() => setEditing(r)}
                    className="flex items-center gap-1 text-xs font-semibold"
                  >
                    <Edit3 className="h-3 w-3 text-slate-500" />
                    Edit
                  </Button>
                ) : null,
            },
          ]}
        />
      ) : null}

      {editing ? (
        <ComponentDialog
          component={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

// ---- templates --------------------------------------------------------------

interface DraftLine {
  key: number;
  componentId: number | "";
  calculationType: CalculationType;
  value: string;
}
let lineKey = 1;

/** Quick CTC Split Simulator Modal for any template */
function TemplateSimulationDialog({
  template,
  onClose,
}: {
  template: SalaryTemplate;
  onClose: () => void;
}) {
  const [grossInput, setGrossInput] = useState("50000");
  const grossNum = Math.max(0, Number(grossInput) || 0);
  const preview = useTemplatePreview(template.id, grossNum);

  const PRESETS = [25000, 50000, 75000, 100000, 150000];

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Simulate CTC: ${template.name}`}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-5">
        {/* Header Summary */}
        <div className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-brand-600 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0a3271] dark:text-white">
                {template.name}
              </h3>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {template.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Simulate monthly component breakup and annual CTC for any gross
              compensation.
            </p>
          </div>
        </div>

        {/* Input & Presets */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Monthly Gross CTC (₹)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-45">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                ₹
              </span>
              <Input
                type="number"
                min={1}
                step={1000}
                value={grossInput}
                onChange={(e) => setGrossInput(e.target.value)}
                className="pl-8 font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESETS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setGrossInput(String(val))}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    grossNum === val
                      ? "bg-brand-500 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  ₹{(val / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Simulation Output Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              Monthly Gross Pay
            </p>
            <p className="mt-1 text-xl font-bold text-[#0a3271] dark:text-white">
              {money(String(grossNum))}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Annualized Gross CTC
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {money(String(grossNum * 12))}
            </p>
          </div>
        </div>

        {/* Calculated Component Lines Table */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-visible dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-xs font-bold text-[#0a3271] dark:text-sky-300 uppercase tracking-wider">
              Component-by-Component Calculated Breakup
            </p>
          </div>
          {preview.isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Calculating salary breakup...
            </div>
          ) : preview.data ? (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {preview.data.lines.map((l) => {
                const monthly = Number(l.monthlyAmount) || 0;
                const pct =
                  grossNum > 0 ? ((monthly / grossNum) * 100).toFixed(1) : "0";
                return (
                  <div
                    key={l.componentId}
                    className="flex items-center justify-between px-4 py-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {l.code}
                      </span>
                      <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {pct}% of Gross
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {money(l.monthlyAmount)}
                        <span className="text-[11px] text-slate-400 font-normal">
                          {" "}
                          / mo
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {money(String(monthly * 12))} / yr
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : preview.isError ? (
            <div className="p-4">
              <ServerError message={describeError(preview.error)} />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close Simulation
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function TemplateDialog({
  template,
  onClose,
}: {
  template: SalaryTemplate | null;
  onClose: () => void;
}) {
  const save = useSaveSalaryTemplate();
  const components = useSalaryComponents(false);
  const { toast } = useToast();
  const [code, setCode] = useState(template?.code ?? "");
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [active, setActive] = useState(template?.isActive ?? true);
  const [lines, setLines] = useState<DraftLine[]>(
    template?.lines.map((l) => ({
      key: lineKey++,
      componentId: l.component.id,
      calculationType: l.calculationType,
      value: l.calculationType === "REMAINDER" ? "" : String(Number(l.value)),
    })) ?? [
      {
        key: lineKey++,
        componentId: "",
        calculationType: "PERCENT_OF_GROSS",
        value: "50",
      },
    ],
  );
  const [previewGross, setPreviewGross] = useState("50000");
  const preview = useTemplatePreview(
    template?.id ?? null,
    Number(previewGross) || 0,
  );
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !template &&
      !/^[A-Z][A-Z0-9_-]{1,39}$/.test(code.trim().toUpperCase())
    ) {
      setError("Code: upper-case letters, digits, _ or - (2–40)");
      return;
    }
    if (name.trim().length < 2) return setError("Give the template a name");
    const body: TemplateLineBody[] = [];
    for (const l of lines) {
      if (l.componentId === "")
        return setError("Choose a component on every line");
      if (
        l.calculationType !== "REMAINDER" &&
        !(Number(l.value) >= 0 && l.value !== "")
      )
        return setError("Every line except the remainder needs a value");
      body.push({
        componentId: l.componentId,
        calculationType: l.calculationType,
        ...(l.calculationType === "REMAINDER"
          ? {}
          : { value: Number(l.value) }),
      });
    }
    if (body.filter((l) => l.calculationType === "REMAINDER").length > 1)
      return setError("Only one line can take the remainder");
    setError(null);
    try {
      await save.mutateAsync({
        id: template?.id ?? null,
        body: {
          ...(template
            ? { isActive: active }
            : { code: code.trim().toUpperCase() }),
          name: name.trim(),
          description: description.trim(),
          lines: body,
        },
      });
      toast({
        title: template ? "Template updated" : "Template created",
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
        template ? `Edit Template: ${template.name}` : "New Salary Template"
      }
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {/* Header Summary Banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-brand-600 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0a3271] dark:text-white">
              {template
                ? `Configure Template: ${template.name}`
                : "Create Salary Template"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Standardized grade breakup applied to employee monthly gross
              compensation.
            </p>
          </div>
        </div>

        {/* Code & Name Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Template Code"
            required
            hint={
              template
                ? "Permanent identifier"
                : "Upper-case identifier e.g. GRADE-A"
            }
          >
            {(f) => (
              <div className="relative">
                <Input
                  {...f}
                  disabled={Boolean(template)}
                  placeholder="e.g. EXEC-GRADE-1"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                    )
                  }
                  className={
                    template
                      ? "bg-gray-100 font-semibold text-gray-700 dark:bg-slate-800"
                      : "font-semibold"
                  }
                />
                {template && (
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                )}
              </div>
            )}
          </FormField>
          <FormField label="Template Display Name" required>
            {(f) => (
              <Input
                {...f}
                placeholder="e.g. Executive Cadre Grade A"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <FormField
          label="Description & Notes"
          hint="Optional grade or department context."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              placeholder="e.g. Standard breakup for engineering and product leads."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </FormField>

        {/* Component Lines Builder */}
        <fieldset className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <legend className="text-xs font-bold text-[#0a3271] dark:text-sky-300 uppercase tracking-wider">
                Salary Structure Component Rules
              </legend>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Evaluated in order: Fixed ₹ and % of gross first, then % of
                Basic, then balancing Remainder.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setLines((ls) => [
                  ...ls,
                  {
                    key: lineKey++,
                    componentId: "",
                    calculationType: "PERCENT_OF_GROSS",
                    value: "",
                  },
                ])
              }
              className="text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Rule
            </Button>
          </div>

          <div className="space-y-2.5">
            {lines.map((l, i) => (
              <div
                key={l.key}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-200/80 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  #{i + 1}
                </span>

                {/* Component Select */}
                <Select
                  aria-label={`Component of template line ${i + 1}`}
                  className="min-w-0 flex-1 sm:w-52 sm:flex-none"
                  value={l.componentId}
                  onChange={(e) =>
                    update(l.key, {
                      componentId: e.target.value ? Number(e.target.value) : "",
                    })
                  }
                >
                  <option value="">Select component</option>
                  {(components.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Select>

                {/* Calculation Type Select */}
                <Select
                  aria-label={`Calculation of template line ${i + 1}`}
                  className="w-44"
                  value={l.calculationType}
                  onChange={(e) =>
                    update(l.key, {
                      calculationType: e.target.value as CalculationType,
                      value: e.target.value === "REMAINDER" ? "" : l.value,
                    })
                  }
                >
                  {CALCULATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CALC_LABEL[t]}
                    </option>
                  ))}
                </Select>

                {/* Value Input */}
                {l.calculationType !== "REMAINDER" ? (
                  <div className="relative w-32">
                    <Input
                      aria-label={`Value of template line ${i + 1}`}
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder="Value"
                      value={l.value}
                      onChange={(e) => update(l.key, { value: e.target.value })}
                      className="pr-7 font-bold text-slate-900 dark:text-white"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {l.calculationType === "FIXED" ? "₹" : "%"}
                    </span>
                  </div>
                ) : (
                  <div className="w-32 px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                    Balancing Remainder
                  </div>
                )}

                {/* Remove Line Button */}
                <button
                  type="button"
                  aria-label={`Remove template line ${i + 1}`}
                  onClick={() =>
                    setLines((ls) => ls.filter((x) => x.key !== l.key))
                  }
                  className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </fieldset>

        {/* Active Toggle Card */}
        {template ? (
          <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 dark:border-slate-800 dark:bg-slate-900/40">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Active Template
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Offered for new employee contracts and annual compensation
                  revisions.
                </p>
              </div>
            </label>
          </div>
        ) : null}

        {/* Live Gross Preview Calculator (for saved template) */}
        {template ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-sky-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0a3271] dark:text-sky-300 uppercase tracking-wider">
                Live Salary Simulation (Current Saved Template)
              </span>
              <span className="text-[11px] text-slate-500">
                Preview at Gross ₹
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-44">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ₹
                </span>
                <Input
                  type="number"
                  min={1}
                  className="pl-7 font-bold text-xs"
                  value={previewGross}
                  onChange={(e) => setPreviewGross(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5">
                {[30000, 50000, 100000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPreviewGross(String(v))}
                    className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  >
                    ₹{(v / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>

            {preview.data ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {preview.data.lines.map((l) => (
                  <div
                    key={l.componentId}
                    className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800"
                  >
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      {l.code}
                    </p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                      {money(l.monthlyAmount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {preview.isError ? (
              <ServerError message={describeError(preview.error)} />
            ) : null}
          </div>
        ) : null}

        <ServerError message={error} />
        <DialogActions
          onCancel={onClose}
          submitting={save.isPending}
          submitLabel={template ? "Save Changes" : "Create Template"}
        />
      </form>
    </Dialog>
  );
}

/** Salary templates — a breakup per grade (§3.0, §4.10). */
export function TemplatesSection() {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const [editing, setEditing] = useState<SalaryTemplate | "new" | null>(null);
  const [simulating, setSimulating] = useState<SalaryTemplate | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ACTIVE" | "ALL" | "INACTIVE"
  >("ACTIVE");
  const [componentFilter, setComponentFilter] = useState<number | "">("");

  // Query all templates (active & inactive)
  const query = useSalaryTemplates(true);
  const allRows = query.data ?? [];
  const componentsQuery = useSalaryComponents(false);
  const allComponents = componentsQuery.data ?? [];

  // Top KPI Metrics
  const totalCount = allRows.length;
  const activeCount = allRows.filter((r) => r.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const totalRules = allRows.reduce((acc, r) => acc + r.lines.length, 0);
  const balancingCount = allRows.filter((r) =>
    r.lines.some((l) => l.calculationType === "REMAINDER"),
  ).length;

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      // Status filter
      if (statusFilter === "ACTIVE" && !r.isActive) return false;
      if (statusFilter === "INACTIVE" && r.isActive) return false;

      // Component filter
      if (
        componentFilter !== "" &&
        !r.lines.some((l) => l.component.id === componentFilter)
      ) {
        return false;
      }

      // Search filter (name, code, or description)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesCode = r.code.toLowerCase().includes(q);
        const matchesDesc = (r.description ?? "").toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesc) return false;
      }

      return true;
    });
  }, [allRows, statusFilter, componentFilter, search]);

  const hasActiveFilters =
    search.trim() !== "" || componentFilter !== "" || statusFilter !== "ACTIVE";

  const handleResetFilters = () => {
    setSearch("");
    setComponentFilter("");
    setStatusFilter("ACTIVE");
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. 4 Interactive Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Templates Card */}
        <button
          type="button"
          onClick={handleResetFilters}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            !hasActiveFilters
              ? "border-2 border-brand-500 bg-sky-50/50 shadow-md ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                Total Templates
              </p>
              {!hasActiveFilters && (
                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                  All
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {activeCount} active · {inactiveCount} inactive
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Layers className="h-5 w-5" />
          </div>
        </button>

        {/* Active Grades Card */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("ACTIVE");
            setComponentFilter("");
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "ACTIVE" && !hasActiveFilters
              ? "border-2 border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-slate-800"
              : "border border-emerald-200/90 bg-white shadow-2xs hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Active Grade Breakups
              </p>
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Available for contract assignment
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </button>

        {/* Formula Rules Card */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Breakup Rules
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-brand-600 dark:text-sky-300">
              {totalRules}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Total component rules configured
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
        </div>

        {/* Balancing Templates Card */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/90 bg-white p-4 shadow-2xs dark:border-amber-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Balancing Structures
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {balancingCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Auto-absorbs remainder to 100% CTC
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. Unified Single-Baseline Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-70">
          {/* Live Search */}
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search template by name or code (e.g. GRADE-A)..."
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

          {/* Component Inclusion Filter */}
          <div className="w-full sm:w-52">
            <Select
              aria-label="Filter templates by component"
              value={componentFilter}
              onChange={(e) =>
                setComponentFilter(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">All Components ({allComponents.length})</option>
              {allComponents.map((c) => (
                <option key={c.id} value={c.id}>
                  Contains {c.code}
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ACTIVE" | "ALL" | "INACTIVE")
              }
            >
              <option value="ACTIVE">Active Only ({activeCount})</option>
              <option value="ALL">All (Incl. Inactive)</option>
              <option value="INACTIVE">Inactive Only ({inactiveCount})</option>
            </Select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Action Button */}
        {canWrite ? (
          <Button
            onClick={() => setEditing("new")}
            className="bg-brand-500 hover:bg-[#1258d4] text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        ) : null}
      </div>

      <QueryState query={query} area="salary templates" />

      {/* 3. Filtered Table View */}
      {query.isSuccess ? (
        <DataTable<SalaryTemplate>
          caption="Salary templates"
          rows={filteredRows}
          getRowKey={(r) => String(r.id)}
          emptyState={
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-brand-600 dark:bg-slate-800 dark:text-sky-400">
                <SlidersHorizontal className="h-6 w-6" />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-800 dark:text-white">
                No matching templates found
              </h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {hasActiveFilters
                  ? "Try clearing some filters to view your salary templates."
                  : "A template is a salary breakup (e.g. per grade) applied to a gross compensation amount."}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-sky-400"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset all filters
                </button>
              )}
            </div>
          }
          columns={[
            {
              header: "Template",
              cell: (r) => (
                <div className="flex flex-col gap-1 py-0.5">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {r.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {r.code}
                    </span>
                    {r.description && (
                      <span className="text-[11px] text-slate-500 truncate max-w-60">
                        {r.description}
                      </span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              header: "Salary Breakup Rules",
              cell: (r) => {
                if (r.lines.length === 0) {
                  return (
                    <span className="text-xs text-slate-400 italic">
                      No components defined
                    </span>
                  );
                }
                return (
                  <div className="flex flex-wrap items-center gap-1.5 max-w-xl py-0.5">
                    {r.lines.map((l) => {
                      if (l.calculationType === "PERCENT_OF_GROSS") {
                        return (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                          >
                            <span className="font-bold">
                              {l.component.code}
                            </span>{" "}
                            · {Number(l.value)}% of Gross
                          </span>
                        );
                      }
                      if (l.calculationType === "PERCENT_OF_BASIC") {
                        return (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <span className="font-bold">
                              {l.component.code}
                            </span>{" "}
                            · {Number(l.value)}% of Basic
                          </span>
                        );
                      }
                      if (l.calculationType === "FIXED") {
                        return (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            <span className="font-bold">
                              {l.component.code}
                            </span>{" "}
                            · {money(l.value)}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={l.id}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <span className="font-bold">{l.component.code}</span>{" "}
                          · Remainder
                        </span>
                      );
                    })}
                  </div>
                );
              },
            },
            {
              header: "Rules",
              cell: (r) => (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {r.lines.length}{" "}
                  {r.lines.length === 1 ? "component" : "components"}
                </span>
              ),
            },
            {
              header: "Status",
              cell: (r) => (
                <StatusPill status={r.isActive ? "ACTIVE" : "INACTIVE"} />
              ),
            },
            {
              header: "Actions",
              cell: (r) => (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSimulating(r)}
                    aria-label={`Simulate template ${r.code}`}
                    className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-sky-50 dark:hover:bg-slate-800"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Simulate
                  </Button>
                  {canWrite ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Edit template ${r.code}`}
                      onClick={() => setEditing(r)}
                      className="flex items-center gap-1 text-xs font-semibold"
                    >
                      <Edit3 className="h-3 w-3 text-slate-500" />
                      Edit
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      ) : null}

      {/* Template Edit Dialog */}
      {editing ? (
        <TemplateDialog
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {/* CTC Simulation Dialog */}
      {simulating ? (
        <TemplateSimulationDialog
          template={simulating}
          onClose={() => setSimulating(null)}
        />
      ) : null}
    </div>
  );
}
