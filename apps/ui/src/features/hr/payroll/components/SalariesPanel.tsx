"use client";

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
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
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
import {
  type EditableLine,
  SalaryLinesEditor,
  linesBody,
  newLine,
} from "./SalaryLinesEditor";

const PAGE_SIZE = 20;

type Mode = "template" | "lines" | "split";

const MODE_LABEL: Record<Mode, string> = {
  template: "From a template",
  lines: "Enter the lines",
  split: "Split a gross (settings percentages)",
};

/** A new effective-dated structure (Docs/PAYROLL_AND_COMPLIANCE.md §3.0). */
function NewSalaryDialog({ onClose }: { onClose: () => void }) {
  // Templates and the component list are payroll configuration; without
  // the settings read grant only the gross split is offered.
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
    let components:
      Array<{ componentId: number; monthlyAmount: number }> | undefined;
    if (mode === "lines") {
      const body = linesBody(lines);
      if ("error" in body) next.lines = body.error;
      else components = body.lines;
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
        ...(mode === "lines" ? { components } : { grossMonthly: grossNumber }),
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
          <DataTable
            caption="Template preview"
            rows={preview.data.lines}
            getRowKey={(r) => String(r.componentId)}
            columns={[
              { header: "Component", cell: (r) => r.code },
              {
                header: "Kind",
                cell: (r) => (r.kind === "EARNING" ? "Earning" : "Deduction"),
              },
              {
                header: "Monthly",
                cell: (r) => money(r.monthlyAmount),
                className: "text-right",
                headerClassName: "text-right",
              },
            ]}
          />
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

/** Change a structure's lines, end date or arrears. A structure used by a
 * finalized payroll keeps its amounts (the API says so). */
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

function SalaryLinesCell({ salary }: { salary: Salary }) {
  const lines = [...salary.components].sort(
    (a, b) => a.component.displayOrder - b.component.displayOrder,
  );
  return (
    <ul className="flex flex-col text-theme-xs">
      {lines.map((l) => (
        <li key={l.component.id} className="flex justify-between gap-3">
          <span>
            {l.component.name}
            {l.component.kind === "DEDUCTION" ? " (−)" : ""}
          </span>
          <span className="whitespace-nowrap">{money(l.monthlyAmount)}</span>
        </li>
      ))}
    </ul>
  );
}

/** HR → Payroll → Salaries: effective-dated structures built over the
 * component master. Team-scoped: a `.team` writer sees and edits only their
 * teams' employees; `.own` reads only their own salary. */
export function SalariesPanel() {
  const canRead = usePermission(SALARY_READ);
  const canWrite = usePermission(SALARY_WRITE);
  const [page, setPage] = useState(1);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [effectiveOn, setEffectiveOn] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Salary | null>(null);
  const query = useSalaries(
    {
      page,
      limit: PAGE_SIZE,
      ...(employee ? { employeeId: employee.id } : {}),
      ...(effectiveOn ? { effectiveOn } : {}),
    },
    canRead,
  );
  const rows = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <div className="w-full sm:w-64">
              <FormField label="Filter by employee">
                {(f) => (
                  <EmployeePicker
                    {...f}
                    value={employee}
                    onChange={(e) => {
                      setEmployee(e);
                      setPage(1);
                    }}
                  />
                )}
              </FormField>
            </div>
            <FormField label="In force on">
              {(f) => (
                <Input
                  {...f}
                  type="date"
                  className="w-full sm:w-44"
                  value={effectiveOn}
                  onChange={(e) => {
                    setEffectiveOn(e.target.value);
                    setPage(1);
                  }}
                />
              )}
            </FormField>
          </div>
          {canWrite ? (
            <Button onClick={() => setCreating(true)}>New salary</Button>
          ) : null}
        </div>
      </Card>

      <QueryState query={query} area="salary structures" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No salary structures"
            description={
              canWrite
                ? "Add an employee's salary to include them in payroll."
                : "No salary structures match these filters."
            }
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <DataTable<Salary>
            caption="Salary structures"
            rows={rows}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Employee",
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{r.employee.fullName}</span>
                    <span className="text-theme-xs text-gray-500">
                      {r.employee.employeeCode}
                    </span>
                  </div>
                ),
              },
              {
                header: "Effective",
                cell: (r) =>
                  `${isoDate(r.effectiveFrom)} – ${r.effectiveTo ? isoDate(r.effectiveTo) : "open"}`,
              },
              {
                header: "Gross",
                cell: (r) => money(r.grossMonthly),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              { header: "Lines", cell: (r) => <SalaryLinesCell salary={r} /> },
              {
                header: "Template",
                cell: (r) => r.salaryTemplate?.name ?? "—",
              },
              {
                header: "Arrears",
                cell: (r) =>
                  Number(r.arrearsSalary) > 0
                    ? `${money(r.arrearsSalary)}${r.arrearsPaidPeriodId ? " (paid)" : ""}`
                    : "—",
              },
              {
                header: "Actions",
                cell: (r) =>
                  canWrite ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Edit salary of ${r.employee.fullName}`}
                      onClick={() => setEditing(r)}
                    >
                      Edit
                    </Button>
                  ) : null,
              },
            ]}
          />
          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}

      {creating ? <NewSalaryDialog onClose={() => setCreating(false)} /> : null}
      {editing ? (
        <EditSalaryDialog salary={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
