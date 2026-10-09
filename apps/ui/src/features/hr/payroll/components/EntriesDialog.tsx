"use client";

import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Pagination,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { days, money, periodLabel } from "../format";
import { useEntries, useEntry } from "../hooks";
import type { PayrollEntry, PayrollRun } from "../types";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 20;

const SOURCE_LABEL: Record<string, string> = {
  PF: "Provident Fund",
  ESI: "ESI",
  LOAN: "Loan EMI",
};

function ratio(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : "—";
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
        {value}
      </dd>
    </div>
  );
}

/** One employee's calculation: attendance → earning ratio → earnings, then
 * deductions → net pay. Read from GET /hr/payroll/entries/:id. */
function EntryDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const query = useEntry(id);
  const e = query.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button size="sm" variant="ghost" onClick={onBack}>
          ← Back to all employees
        </Button>
      </div>
      <QueryState query={query} area="this payroll entry" />
      {e ? (
        <section aria-label={`Payroll for ${e.employee.fullName}`}>
          <h3 className="text-theme-md font-semibold text-gray-900 dark:text-white/90">
            {e.employee.fullName}{" "}
            <span className="font-normal text-gray-500">
              ({e.employee.employeeCode})
            </span>
          </h3>

          <h4 className="mt-4 mb-2 text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
            Attendance
          </h4>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Calendar days" value={e.totalCalendarDays} />
            <Fact label="Working days" value={e.requiredWorkingDays} />
            <Fact label="Present" value={days(e.presentDays)} />
            <Fact label="Half days" value={days(e.halfDays)} />
            <Fact label="Holidays" value={days(e.holidayDays)} />
            <Fact label="Paid leave" value={days(e.leaveDays)} />
            <Fact label="Loss of pay" value={days(e.lopDays)} />
            <Fact label="Payable days" value={days(e.payableDays)} />
          </dl>

          <h4 className="mt-4 mb-2 text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
            Pay calculation
          </h4>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Monthly gross" value={money(e.monthlyGross)} />
            <Fact label="Per-day rate" value={money(e.perDayRate)} />
            <Fact label="Earning ratio" value={ratio(e.earningRatio)} />
            <Fact label="Base earnings" value={money(e.baseEarnings)} />
          </dl>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <DataTable
              caption="Earnings"
              rows={e.earnings}
              getRowKey={(r) => String(r.id)}
              columns={[
                { header: "Earning", cell: (r) => r.name },
                {
                  header: "Full month",
                  cell: (r) => money(r.baseAmount),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Ratio",
                  cell: (r) => ratio(r.earningRatio),
                  className: "text-right",
                  headerClassName: "text-right",
                },
                {
                  header: "Paid",
                  cell: (r) => money(r.calculatedAmount),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
              ]}
            />
            {e.deductions.length > 0 ? (
              <DataTable
                caption="Deductions"
                rows={e.deductions}
                getRowKey={(r) => String(r.id)}
                columns={[
                  { header: "Deduction", cell: (r) => r.name },
                  {
                    header: "Source",
                    cell: (r) =>
                      r.sourceType
                        ? (SOURCE_LABEL[r.sourceType] ?? r.sourceType)
                        : "—",
                  },
                  {
                    header: "Amount",
                    cell: (r) => money(r.amount),
                    className: "text-right whitespace-nowrap",
                    headerClassName: "text-right",
                  },
                ]}
              />
            ) : (
              <p className="text-theme-sm text-gray-600 dark:text-gray-400">
                No deductions.
              </p>
            )}
          </div>

          <dl className="mt-4 grid gap-2 sm:grid-cols-3">
            <Fact label="Gross earnings" value={money(e.totalGrossEarnings)} />
            <Fact label="Total deductions" value={money(e.totalDeductions)} />
            <Fact
              label="Net pay"
              value={
                <span className="text-theme-md">{money(e.netPayable)}</span>
              }
            />
          </dl>
          {e.payslip ? (
            <p className="mt-3 text-theme-xs text-gray-600 dark:text-gray-400">
              Payslip {e.payslip.payslipNumber} issued.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function EntryList({
  runId,
  onOpen,
}: {
  runId: number;
  onOpen: (entry: PayrollEntry) => void;
}) {
  const [page, setPage] = useState(1);
  const query = useEntries({ page, limit: PAGE_SIZE, payrollRunId: runId });
  const rows = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <QueryState query={query} area="payroll entries" />
      {query.isSuccess && rows.length === 0 ? (
        <EmptyState
          title="No entries"
          description="This run has no calculated employees."
        />
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <DataTable<PayrollEntry>
            caption="Payroll entries"
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
                header: "Payable days",
                cell: (r) => `${days(r.payableDays)} / ${r.totalCalendarDays}`,
              },
              { header: "LOP", cell: (r) => days(r.lopDays) },
              {
                header: "Gross",
                cell: (r) => money(r.totalGrossEarnings),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Deductions",
                cell: (r) => money(r.totalDeductions),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Net pay",
                cell: (r) => (
                  <span className="font-semibold">{money(r.netPayable)}</span>
                ),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Details",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`View payroll for ${r.employee.fullName}`}
                    onClick={() => onOpen(r)}
                  >
                    View
                  </Button>
                ),
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
    </div>
  );
}

/** Per-employee results of one payroll run, with a drill-down into one
 * employee's calculation. The drill-down is a view inside this dialog, not
 * a second dialog (see the note on dialogs in PeriodsPanel). */
export function EntriesDialog({
  run,
  onClose,
}: {
  run: PayrollRun;
  onClose: () => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Run #${run.runNumber} — ${periodLabel(run.payrollPeriod)}`}
      className="max-w-5xl"
    >
      {openId ? (
        <EntryDetail id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <EntryList runId={run.id} onOpen={(e) => setOpenId(e.id)} />
      )}
    </Dialog>
  );
}
