"use client";

import {
  Alert,
  Button,
  DataTable,
  Dialog,
  FormField,
  Input,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
import { usePermission } from "@/hooks/usePermission";
import { currentFinancialYear, describeError, money } from "../format";
import { useCreateGratuity, useGratuity, useStatutoryBonus } from "../hooks";
import { BONUS_WRITE } from "../permissions";
import type { StatutoryBonusResult } from "../types";
import { ServerError } from "./DialogParts";
import { OpenPeriodSelect } from "./OpenPeriodSelect";

/**
 * Statutory bonus for a financial year (Docs/PAYROLL_AND_COMPLIANCE.md
 * §3.9), from its finalized payroll. "Calculate" is a preview; "Raise
 * bonuses" creates a PENDING statutory bonus for every eligible employee
 * who has none for that year — each still needs a second person's approval.
 * Organization-wide: the caller holds `hr.bonus.write.all`.
 */
export function StatutoryBonusDialog({ onClose }: { onClose: () => void }) {
  const run = useStatutoryBonus();
  const { toast } = useToast();
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());
  const [result, setResult] = useState<StatutoryBonusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[0-9]{4}-[0-9]{2}$/.test(financialYear);
  const toRaise =
    result?.employees.filter(
      (e) => e.eligible && e.amount > 0 && !e.alreadyRaised,
    ) ?? [];

  async function calculate(create: boolean) {
    setError(null);
    try {
      const res = await run.mutateAsync({ financialYear, create });
      setResult(res);
      if (create) {
        toast({
          title: `${res.createdBonusIds.length} statutory bonus(es) raised — awaiting approval`,
          variant: "success",
        });
      }
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Statutory bonus"
      className="max-w-4xl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          Worked out from the finalized payroll of the year: eligible when Basic
          + DA is within the limit and at least 30 days were worked; the bonus
          is the configured percentage of Basic + DA, capped each month at the
          calculation ceiling (Payroll settings).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <FormField
            label="Financial year"
            hint="Like 2025-26"
            error={valid ? undefined : "Write it like 2025-26"}
          >
            {(f) => (
              <Input
                {...f}
                className="w-36"
                value={financialYear}
                onChange={(e) => {
                  setFinancialYear(e.target.value.trim());
                  setResult(null);
                }}
              />
            )}
          </FormField>
          <Button
            variant="secondary"
            disabled={!valid}
            loading={run.isPending && !result}
            onClick={() => void calculate(false)}
          >
            Calculate
          </Button>
          {result && toRaise.length > 0 ? (
            <Button
              loading={run.isPending}
              onClick={() => void calculate(true)}
            >
              Raise {toRaise.length} bonus(es)
            </Button>
          ) : null}
        </div>
        <ServerError message={error} />
        {result ? (
          <>
            <p className="text-theme-xs text-gray-600 dark:text-gray-400">
              Limit {money(result.rules.eligibilityLimit)} · ceiling{" "}
              {money(result.rules.calculationCeiling)} · {result.rules.percent}%
            </p>
            {result.employees.length === 0 ? (
              <Alert variant="info" title="No finalized payroll">
                No period of {result.financialYear} is finalized yet.
              </Alert>
            ) : (
              <DataTable
                caption={`Statutory bonus ${result.financialYear}`}
                rows={result.employees}
                getRowKey={(r) => String(r.employee.id)}
                columns={[
                  {
                    header: "Employee",
                    cell: (r) =>
                      `${r.employee.fullName} (${r.employee.employeeCode})`,
                  },
                  {
                    header: "Basic + DA",
                    cell: (r) => money(r.monthlyBasicDa),
                    className: "text-right",
                    headerClassName: "text-right",
                  },
                  { header: "Days", cell: (r) => r.workedDays },
                  {
                    header: "Bonus",
                    cell: (r) => (r.eligible ? money(r.amount) : "—"),
                    className: "text-right",
                    headerClassName: "text-right",
                  },
                  {
                    header: "Note",
                    cell: (r) =>
                      r.alreadyRaised
                        ? "Already raised for this year"
                        : (r.reason ?? "Eligible"),
                  },
                ]}
              />
            )}
          </>
        ) : null}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Gratuity due to one employee as of a date (default: their exit date or
 * today). With `hr.bonus.write` it can be raised as a GRATUITY bonus,
 * PENDING approval, paid by a payroll run (not taxable, not an ESI wage).
 */
export function GratuityDialog({ onClose }: { onClose: () => void }) {
  const canWrite = usePermission(BONUS_WRITE);
  const create = useCreateGratuity();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [asOf, setAsOf] = useState("");
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useGratuity(employee?.id ?? null, asOf);
  const g = query.data;

  async function raise() {
    if (!employee || !g) return;
    setError(null);
    try {
      await create.mutateAsync({
        employeeId: employee.id,
        asOf: g.asOf,
        payrollPeriodId: periodId ?? undefined,
      });
      toast({
        title: `Gratuity of ${money(g.amount)} raised for ${employee.fullName} — awaiting approval`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Gratuity">
      <div className="flex flex-col gap-4">
        <FormField label="Employee" required>
          {(f) => (
            <EmployeePicker {...f} value={employee} onChange={setEmployee} />
          )}
        </FormField>
        <FormField
          label="As of"
          hint="Leave empty for the exit date, or today."
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          )}
        </FormField>
        {query.isError ? (
          <ServerError message={describeError(query.error)} />
        ) : null}
        {g ? (
          <dl className="grid grid-cols-2 gap-2">
            {(
              [
                ["As of", g.asOf],
                ["Completed years", g.completedYears],
                ["Counted years", g.countedYears],
                ["Basic + DA", money(g.lastDrawnWage)],
                ["Gratuity", g.eligible ? money(g.amount) : "Not eligible"],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
              >
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {label}
                </dt>
                <dd className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {g && !g.eligible ? (
          <Alert variant="info" title="Not eligible">
            {g.reason}
          </Alert>
        ) : null}
        {g?.eligible && canWrite ? (
          <FormField
            label="Pay with payroll period"
            hint="Optional — the full and final settlement month."
          >
            {(f) => (
              <OpenPeriodSelect
                {...f}
                value={periodId}
                onChange={setPeriodId}
                emptyLabel="Not assigned yet"
              />
            )}
          </FormField>
        ) : null}
        <ServerError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {g?.eligible && canWrite ? (
            <Button loading={create.isPending} onClick={() => void raise()}>
              Raise gratuity
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
