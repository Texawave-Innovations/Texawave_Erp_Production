"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Edit2,
  Filter,
  Plus,
  RotateCcw,
  Search,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
import {
  EMPLOYEE_READ_ANY_SCOPE,
  useEmployeeOptions,
} from "@/components/widgets/employee-picker.api";
import { usePermission } from "@/hooks/usePermission";
import { describeError, isoDate, money } from "../format";
import {
  useCreateSalary,
  useSalaries,
  useSalaryComponents,
  useSalaryTemplates,
  useTemplatePreview,
  useUpdateSalary,
} from "../hooks";
import {
  PAYROLL_SETTINGS_READ,
  SALARY_READ,
  SALARY_WRITE,
} from "../permissions";
import type { Salary } from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { QueryState } from "./QueryState";
import { SalaryCard } from "./SalaryCard";
import {
  type EditableLine,
  SalaryLinesEditor,
  linesBody,
  newLine,
} from "./SalaryLinesEditor";

const PAGE_SIZE = 12;

type Mode = "template" | "lines" | "split";
type StatusFilter = "" | "in-force" | "scheduled" | "historical" | "arrears";

const MODE_LABEL: Record<Mode, string> = {
  template: "From a template",
  lines: "Enter the lines",
  split: "Split a gross (settings percentages)",
};

/** A new effective-dated structure (Docs/PAYROLL_AND_COMPLIANCE.md §3.0). */
function NewSalaryDialog({ onClose }: { onClose: () => void }) {
  const canReadMasters = usePermission(PAYROLL_SETTINGS_READ);
  const create = useCreateSalary();
  const templates = useSalaryTemplates(false, canReadMasters);
  const components = useSalaryComponents(false, canReadMasters);
  const { toast } = useToast();
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState<Mode>(canReadMasters ? "template" : "split");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [gross, setGross] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([newLine()]);
  const [arrears, setArrears] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const grossNumber = Number(gross) || 0;
  const preview = useTemplatePreview(
    mode === "template" ? templateId : null,
    grossNumber,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!employee) next.employee = "Choose an employee";
    if (!from) next.from = "Choose the start date";
    if (to && from && to < from) next.to = "The end is before the start";
    let componentsBody:
      Array<{ componentId: number; monthlyAmount: number }> | undefined;
    if (mode === "lines") {
      const body = linesBody(lines);
      if ("error" in body) next.lines = body.error;
      else componentsBody = body.lines;
    } else {
      if (!(grossNumber > 0)) next.gross = "Enter the gross monthly salary";
      if (mode === "template" && !templateId)
        next.template = "Choose a template";
    }
    if (arrears && !(Number(arrears) >= 0)) next.arrears = "Enter ₹0 or more";
    setErrors(next);
    if (Object.keys(next).length > 0 || !employee) return;
    setServerError(null);
    try {
      await create.mutateAsync({
        employeeId: employee.id,
        effectiveFrom: from,
        effectiveTo: to || undefined,
        ...(mode === "lines"
          ? { components: componentsBody }
          : { grossMonthly: grossNumber }),
        ...(mode === "template" && templateId
          ? { salaryTemplateId: templateId }
          : {}),
        ...(arrears ? { arrearsSalary: Number(arrears) } : {}),
      });
      toast({
        title: `Salary structure saved for ${employee.fullName}`,
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
      title="New salary structure"
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Employee" required error={errors.employee}>
          {(f) => (
            <EmployeePicker {...f} value={employee} onChange={setEmployee} />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Effective from" required error={errors.from}>
            {(f) => (
              <Input
                {...f}
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Effective to"
            hint="Optional — leave open-ended."
            error={errors.to}
          >
            {(f) => (
              <Input
                {...f}
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="How to build the salary">
          {(f) => (
            <Select
              {...f}
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              {(canReadMasters
                ? (["template", "lines", "split"] as const)
                : (["split"] as const)
              ).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {mode === "template" ? (
          <FormField label="Template" required error={errors.template}>
            {(f) => (
              <Select
                {...f}
                disabled={templates.isPending}
                value={templateId ?? ""}
                onChange={(e) =>
                  setTemplateId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">
                  {templates.isPending
                    ? "Loading templates…"
                    : (templates.data ?? []).length === 0
                      ? "No templates yet (Payroll settings → Templates)"
                      : "Choose a template"}
                </option>
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        ) : null}

        {mode !== "lines" ? (
          <FormField
            label="Gross monthly (₹)"
            required
            error={errors.gross}
            hint={
              mode === "split"
                ? "Split into Basic / HRA / Conveyance / Other by the payroll settings."
                : undefined
            }
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={1}
                inputMode="decimal"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
              />
            )}
          </FormField>
        ) : (
          <SalaryLinesEditor
            lines={lines}
            onChange={setLines}
            components={components.data ?? []}
            error={errors.lines}
          />
        )}

        {mode === "template" && preview.data ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="pb-2 font-semibold">Component</th>
                  <th className="pb-2 font-semibold">Kind</th>
                  <th className="pb-2 text-right font-semibold">Monthly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.data.lines.map((r) => (
                  <tr key={r.componentId}>
                    <td className="py-2 font-medium">{r.code}</td>
                    <td className="py-2">
                      {r.kind === "EARNING" ? "Earning" : "Deduction"}
                    </td>
                    <td className="py-2 text-right font-bold">
                      {money(r.monthlyAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {mode === "template" && preview.isError ? (
          <ServerError message={describeError(preview.error)} />
        ) : null}

        <FormField
          label="Arrears (₹)"
          hint="Optional one-time amount, paid by the next finalized month."
          error={errors.arrears}
        >
          {(f) => (
            <Input
              {...f}
              type="number"
              min={0}
              inputMode="decimal"
              value={arrears}
              onChange={(e) => setArrears(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Save salary"
        />
      </form>
    </Dialog>
  );
}

/** Change a structure's lines, end date or arrears. */
function EditSalaryDialog({
  salary,
  onClose,
}: {
  salary: Salary;
  onClose: () => void;
}) {
  const update = useUpdateSalary();
  const canReadMasters = usePermission(PAYROLL_SETTINGS_READ);
  const components = useSalaryComponents(true, canReadMasters);
  const { toast } = useToast();
  const [lines, setLines] = useState<EditableLine[]>(
    salary.components.map((c) =>
      newLine(c.component.id, String(Number(c.monthlyAmount))),
    ),
  );
  const [linesTouched, setLinesTouched] = useState(false);
  const [to, setTo] = useState(
    isoDate(salary.effectiveTo) === "—" ? "" : isoDate(salary.effectiveTo),
  );
  const [arrears, setArrears] = useState(String(Number(salary.arrearsSalary)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    let body: Array<{ componentId: number; monthlyAmount: number }> | undefined;
    if (linesTouched) {
      const parsed = linesBody(lines);
      if ("error" in parsed) next.lines = parsed.error;
      else body = parsed.lines;
    }
    if (to && to < isoDate(salary.effectiveFrom))
      next.to = "The end is before the start";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const currentTo =
      isoDate(salary.effectiveTo) === "—" ? "" : isoDate(salary.effectiveTo);
    setServerError(null);
    try {
      await update.mutateAsync({
        id: salary.id,
        body: {
          ...(body ? { components: body } : {}),
          ...(to !== currentTo ? { effectiveTo: to } : {}),
          ...(Number(arrears) !== Number(salary.arrearsSalary)
            ? { arrearsSalary: Number(arrears) || 0 }
            : {}),
        },
      });
      toast({ title: "Salary structure updated", variant: "success" });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Salary of ${salary.employee.fullName}`}
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          From {isoDate(salary.effectiveFrom)}
          {salary.salaryTemplate
            ? ` · template ${salary.salaryTemplate.name}`
            : ""}
          {salary.revisionLetter
            ? ` · revision letter ${salary.revisionLetter.documentNo}`
            : ""}
        </p>
        {canReadMasters ? (
          <SalaryLinesEditor
            lines={lines}
            onChange={(l) => {
              setLines(l);
              setLinesTouched(true);
            }}
            components={components.data ?? []}
            error={errors.lines}
          />
        ) : (
          <Alert variant="info" title="Lines are read-only here">
            Changing the lines needs the payroll settings read permission (the
            component list).
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Effective to"
            hint="Empty = open-ended."
            error={errors.to}
          >
            {(f) => (
              <Input
                {...f}
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Arrears (₹)"
            hint="Changing it schedules a new one-time payment."
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                inputMode="decimal"
                value={arrears}
                onChange={(e) => setArrears(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={update.isPending}
          submitLabel="Save changes"
        />
      </form>
    </Dialog>
  );
}

/** HR → Payroll → Salaries */
export function SalariesPanel() {
  const canRead = usePermission(SALARY_READ);
  const canWrite = usePermission(SALARY_WRITE);
  const canReadEmployees = usePermission(EMPLOYEE_READ_ANY_SCOPE);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [effectiveOn, setEffectiveOn] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Salary | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Single-line employee options for toolbar dropdown
  const employeesQuery = useEmployeeOptions("", canReadEmployees);
  const employeeOptions = employeesQuery.data?.data ?? [];

  // Summary query to compute organization/team-level KPI metrics
  const summaryQuery = useSalaries(
    {
      page: 1,
      limit: 100,
    },
    canRead,
  );

  // Filtered queries
  const query = useSalaries(
    {
      page,
      limit: PAGE_SIZE,
      ...(employeeId ? { employeeId } : {}),
      ...(effectiveOn ? { effectiveOn } : {}),
    },
    canRead,
  );

  const rawRows = query.data?.data ?? [];
  const todayStr = new Date().toISOString().slice(0, 10);

  // Client-side search and quick status filters
  const rows = useMemo(() => {
    let result = rawRows;

    // Apply status filter
    if (statusFilter === "in-force") {
      result = result.filter(
        (s) =>
          s.effectiveFrom <= todayStr &&
          (!s.effectiveTo || s.effectiveTo >= todayStr),
      );
    } else if (statusFilter === "scheduled") {
      result = result.filter((s) => s.effectiveFrom > todayStr);
    } else if (statusFilter === "historical") {
      result = result.filter((s) => s.effectiveTo && s.effectiveTo < todayStr);
    } else if (statusFilter === "arrears") {
      result = result.filter(
        (s) => Number(s.arrearsSalary || 0) > 0 && !s.arrearsPaidPeriodId,
      );
    }

    // Apply search query
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((s) => {
        const name = s.employee.fullName.toLowerCase();
        const code = s.employee.employeeCode.toLowerCase();
        const template = s.salaryTemplate?.name.toLowerCase() ?? "";
        return name.includes(q) || code.includes(q) || template.includes(q);
      });
    }

    return result;
  }, [rawRows, search, statusFilter, todayStr]);

  // KPI Metrics Calculation
  const { totalStructures, inForceCount, avgGross, pendingArrearsCount } =
    useMemo(() => {
      const allItems = summaryQuery.data?.data ?? [];
      const total = summaryQuery.data?.meta?.total ?? allItems.length;

      const inForce = allItems.filter(
        (s) =>
          s.effectiveFrom <= todayStr &&
          (!s.effectiveTo || s.effectiveTo >= todayStr),
      ).length;

      const grossSum = allItems.reduce(
        (acc, s) => acc + Number(s.grossMonthly || 0),
        0,
      );
      const average = allItems.length > 0 ? grossSum / allItems.length : 0;

      const arrearsCount = allItems.filter(
        (s) => Number(s.arrearsSalary || 0) > 0 && !s.arrearsPaidPeriodId,
      ).length;

      return {
        totalStructures: total,
        inForceCount: inForce,
        avgGross: average,
        pendingArrearsCount: arrearsCount,
      };
    }, [summaryQuery.data, todayStr]);

  const hasFilters =
    search !== "" ||
    employeeId !== null ||
    effectiveOn !== "" ||
    statusFilter !== "";

  const handleClearFilters = () => {
    setSearch("");
    setEmployeeId(null);
    setEffectiveOn("");
    setStatusFilter("");
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5 animate-reveal">
      {/* 4 Interactive Metric KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Salary Structures Card */}
        <button
          type="button"
          onClick={() => {
            handleClearFilters();
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "" && !hasFilters
              ? "border-2 border-brand-500 bg-sky-50/50 shadow-md ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                Total Structures
              </p>
              {statusFilter === "" && !hasFilters ? (
                <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:text-sky-300">
                  All
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalStructures}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Employees with structures
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 transition-transform group-hover:scale-105 dark:border-slate-700 dark:bg-slate-800">
            <Wallet className="h-5 w-5" />
          </div>
        </button>

        {/* In Force Today Card */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) => (prev === "in-force" ? "" : "in-force"));
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "in-force"
              ? "border-2 border-emerald-500 bg-emerald-50/60 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-950/30"
              : "border border-emerald-200/90 bg-white shadow-2xs hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                In Force Today
              </p>
              {statusFilter === "in-force" ? (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                  Active Filter
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {inForceCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Active in current cycle
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-105 dark:border-emerald-900 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </button>

        {/* Average Monthly Gross Card */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              Avg. Monthly Gross
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {money(avgGross)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Per employee / month
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-600 dark:border-slate-700 dark:bg-slate-800">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Pending Arrears Card */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) => (prev === "arrears" ? "" : "arrears"));
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "arrears"
              ? "border-2 border-amber-500 bg-amber-50/60 shadow-md ring-2 ring-amber-500/20 dark:border-amber-400 dark:bg-amber-950/30"
              : "border border-amber-200/90 bg-white shadow-2xs hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pending Arrears
              </p>
              {statusFilter === "arrears" ? (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                  Active Filter
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {pendingArrearsCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Unsettled one-time payments
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition-transform group-hover:scale-105 dark:border-amber-900 dark:bg-amber-950/40">
            <Clock className="h-5 w-5" />
          </div>
        </button>
      </div>

      {/* Unified, Perfectly Aligned Filter & Action Toolbar */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Unified Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search name, code, or template..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 pr-8 h-10"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* Single-line Employee Dropdown */}
            <Select
              aria-label="Filter by employee"
              className="w-full sm:w-48 h-10"
              value={employeeId ? String(employeeId) : ""}
              onChange={(e) => {
                setEmployeeId(e.target.value ? Number(e.target.value) : null);
                setPage(1);
              }}
            >
              <option value="">All employees</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode})
                </option>
              ))}
            </Select>

            {/* Status Filter Dropdown */}
            <Select
              aria-label="Filter by status"
              className="w-full sm:w-44 h-10"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="in-force">In force today</option>
              <option value="scheduled">Scheduled (future)</option>
              <option value="historical">Historical (expired)</option>
              <option value="arrears">Pending arrears</option>
            </Select>

            {/* In Force Date Input */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Input
                type="date"
                aria-label="Filter by in-force date"
                placeholder="In force on date"
                value={effectiveOn}
                onChange={(e) => {
                  setEffectiveOn(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-40 h-10"
              />
            </div>

            {/* Reset Button */}
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs text-slate-500 hover:text-brand-600 h-10"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>

          {/* New Salary Action Button */}
          {canWrite ? (
            <Button
              onClick={() => setCreating(true)}
              className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs shrink-0 h-10 px-4"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Salary
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Query Status / Error Area */}
      <QueryState query={query} area="salary structures" />

      {/* Empty State */}
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No salary structures found"
            description={
              hasFilters
                ? "No salary structures match your active search or filters. Try resetting filters."
                : canWrite
                  ? "Add an employee's salary structure to include them in monthly payroll runs."
                  : "No salary structures configured yet."
            }
            action={
              hasFilters ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleClearFilters}
                >
                  Reset filters
                </Button>
              ) : canWrite ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create Salary Structure
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : null}

      {/* Interactive Salary Cards List */}
      {query.isSuccess && rows.length > 0 ? (
        <div className="flex flex-col gap-3.5">
          {rows.map((salary) => (
            <SalaryCard
              key={salary.id}
              salary={salary}
              canWrite={canWrite}
              onEdit={(s) => setEditing(s)}
              isExpanded={expandedId === salary.id}
              onToggleExpand={() =>
                setExpandedId((prev) => (prev === salary.id ? null : salary.id))
              }
            />
          ))}

          {/* Pagination Controls */}
          <div className="pt-2">
            <Pagination
              page={page}
              totalPages={query.data?.meta?.totalPages ?? 1}
              onPageChange={setPage}
            />
          </div>
        </div>
      ) : null}

      {/* Dialogs */}
      {creating ? <NewSalaryDialog onClose={() => setCreating(false)} /> : null}
      {editing ? (
        <EditSalaryDialog salary={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
