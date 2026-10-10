"use client";

import {
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  EmployeePicker,
  type EmployeeOption,
} from "@/components/widgets/EmployeePicker";
import { describeError, MONTH_OPTIONS, periodLabel } from "../format";
import {
  useApproveRun,
  useCancelPeriod,
  useCreatePeriod,
  useCreateRun,
  useFinalizePeriod,
} from "../hooks";
import { createPeriodSchema, runNotesSchema } from "../schema";
import type { PayrollPeriod, PayrollRun } from "../types";

import { DialogActions as Actions, ServerError } from "./DialogParts";

// ---- create period --------------------------------------------------------

export function CreatePeriodDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (period: PayrollPeriod) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreatePeriod();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createPeriodSchema.safeParse({
      year,
      month,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      const period = await create.mutateAsync(parsed.data);
      toast({
        title: `Payroll period ${periodLabel(period)} created`,
        variant: "success",
      });
      onCreated(period);
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New payroll period">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Year" required error={errors.year}>
            {(f) => (
              <Input
                {...f}
                type="number"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Month" required error={errors.month}>
            {(f) => (
              <Select
                {...f}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField
            label="Start date"
            hint="Optional. Defaults to the 1st of the month."
            error={errors.periodStart}
          >
            {(f) => (
              <Input
                {...f}
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="End date"
            hint="Optional. Defaults to the last day of the month."
            error={errors.periodEnd}
          >
            {(f) => (
              <Input
                {...f}
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <ServerError message={serverError} />
        <Actions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Create period"
        />
      </form>
    </Dialog>
  );
}

// ---- run payroll / approve run -------------------------------------------

function NotesDialog({
  open,
  onClose,
  title,
  intro,
  submitLabel,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: React.ReactNode;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = runNotesSchema.safeParse({ notes });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setServerError(null);
    try {
      await onSubmit(parsed.data.notes);
      setNotes("");
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="rounded-lg bg-gray-50 p-3 text-theme-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {intro}
        </div>
        <FormField label="Notes" hint="Optional." error={error}>
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              value={notes}
              disabled={submitting}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <Actions
          onCancel={onClose}
          submitting={submitting}
          submitLabel={submitLabel}
        />
      </form>
    </Dialog>
  );
}

export function RunPayrollDialog({
  open,
  onClose,
  period,
}: {
  open: boolean;
  onClose: () => void;
  period: PayrollPeriod;
}) {
  const run = useCreateRun();
  const { toast } = useToast();
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [picking, setPicking] = useState<EmployeeOption | null>(null);
  const [selected, setSelected] = useState<EmployeeOption[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{
    employees?: string | undefined;
    notes?: string | undefined;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function addPicked(employee: EmployeeOption | null) {
    setPicking(null);
    if (employee && !selected.some((e) => e.id === employee.id)) {
      setSelected((list) => [...list, employee]);
      setErrors((e) => ({ ...e, employees: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const parsed = runNotesSchema.safeParse({ notes });
    if (!parsed.success) next.notes = parsed.error.issues[0]?.message;
    if (scope === "selected" && selected.length === 0)
      next.employees = "Add at least one employee";
    setErrors(next);
    if (!parsed.success || next.employees) return;

    setServerError(null);
    try {
      const created = await run.mutateAsync({
        payrollPeriodId: period.id,
        ...(scope === "selected"
          ? { employeeIds: selected.map((s) => s.id) }
          : {}),
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      });
      toast({
        title: `Run #${created.runNumber} processed`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Run payroll">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="rounded-lg bg-gray-50 p-3 text-theme-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Calculates pay for <strong>{periodLabel(period)}</strong> from
          salaries, attendance, leave, loans and bonuses. Running again replaces
          the previous run (even an approved one, which then needs approving
          again) and withdraws any payslips generated from it.
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-theme-sm font-medium text-gray-700 dark:text-white/90">
            Employees
          </legend>
          {(
            [
              ["all", "All eligible employees"],
              ["selected", "Add or recalculate selected employees"],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300"
            >
              <input
                type="radio"
                name="run-scope"
                value={value}
                checked={scope === value}
                disabled={run.isPending}
                onChange={() => setScope(value)}
              />
              {text}
            </label>
          ))}
        </fieldset>

        {scope === "selected" ? (
          <div className="flex flex-col gap-2">
            <FormField
              label="Add employee"
              error={errors.employees}
              hint="Pick employees one at a time. Everyone already in this period's run stays in it and is recalculated too."
            >
              {(f) => (
                <EmployeePicker
                  {...f}
                  value={picking}
                  onChange={addPicked}
                  disabled={run.isPending}
                />
              )}
            </FormField>
            {selected.length > 0 ? (
              <ul
                aria-label="Selected employees"
                className="flex flex-wrap gap-2"
              >
                {selected.map((emp) => (
                  <li
                    key={emp.id}
                    className="flex items-center gap-1 rounded-full bg-brand-50 py-1 pr-1 pl-3 text-theme-xs text-brand-800 dark:bg-brand-950 dark:text-brand-300"
                  >
                    {emp.fullName} ({emp.employeeCode})
                    <button
                      type="button"
                      aria-label={`Remove ${emp.fullName}`}
                      className="rounded-full px-1.5 hover:bg-brand-100 dark:hover:bg-brand-900"
                      onClick={() =>
                        setSelected((list) =>
                          list.filter((x) => x.id !== emp.id),
                        )
                      }
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <FormField label="Notes" hint="Optional." error={errors.notes}>
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={notes}
              disabled={run.isPending}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <Actions
          onCancel={onClose}
          submitting={run.isPending}
          submitLabel="Run payroll"
        />
      </form>
    </Dialog>
  );
}

export function ApproveRunDialog({
  open,
  onClose,
  run,
}: {
  open: boolean;
  onClose: () => void;
  run: PayrollRun;
}) {
  const approve = useApproveRun();
  const { toast } = useToast();
  return (
    <NotesDialog
      open={open}
      onClose={onClose}
      title="Approve payroll run"
      submitLabel="Approve"
      submitting={approve.isPending}
      intro={
        <>
          Approve run <strong>#{run.runNumber}</strong> for{" "}
          {periodLabel(run.payrollPeriod)} ({run._count.entries} employee
          {run._count.entries === 1 ? "" : "s"}). The person who ran payroll
          cannot approve it.
        </>
      }
      onSubmit={async (notes) => {
        await approve.mutateAsync({ id: run.id, ...(notes ? { notes } : {}) });
        toast({ title: `Run #${run.runNumber} approved`, variant: "success" });
      }}
    />
  );
}

// ---- finalize / cancel period --------------------------------------------

export function ConfirmPeriodDialog({
  open,
  onClose,
  period,
  action,
}: {
  open: boolean;
  onClose: () => void;
  period: PayrollPeriod;
  action: "finalize" | "cancel";
}) {
  const finalize = useFinalizePeriod();
  const cancel = useCancelPeriod();
  const mutation = action === "finalize" ? finalize : cancel;
  const [serverError, setServerError] = useState<string | null>(null);
  const { toast } = useToast();
  const label = periodLabel(period);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    try {
      await mutation.mutateAsync(period.id);
      toast({
        title:
          action === "finalize"
            ? `${label} finalized — payslips generated`
            : `${label} cancelled`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={action === "finalize" ? "Finalize period" : "Cancel period"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          {action === "finalize" ? (
            <>
              Finalize <strong>{label}</strong>? Payslips are generated from the
              approved run and the period is locked — no further runs, bonuses
              or loan changes for it.
            </>
          ) : (
            <>
              Cancel <strong>{label}</strong>? No payroll can be run for a
              cancelled period.
            </>
          )}
        </p>
        <ServerError message={serverError} />
        <Actions
          onCancel={onClose}
          submitting={mutation.isPending}
          submitLabel={action === "finalize" ? "Finalize" : "Cancel period"}
          destructive={action === "cancel"}
        />
      </form>
    </Dialog>
  );
}
