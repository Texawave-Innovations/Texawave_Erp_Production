"use client";

import {
  DataTable,
  Dialog,
  EmptyState,
  Pagination,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { days, money, periodLabel } from "../format";
import { useEntries } from "../hooks";
import type { PayrollEntry, PayrollRun } from "../types";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 20;

function Breakdown({ entry }: { entry: PayrollEntry }) {
  return (
    <details className="text-theme-xs">
      <summary className="cursor-pointer text-brand-700 dark:text-brand-300">
        Breakdown
      </summary>
      <ul className="mt-1 flex flex-col gap-0.5 text-gray-600 dark:text-gray-400">
        {entry.earnings.map((e) => (
          <li key={`e-${e.id}`}>
            + {e.name}: {money(e.calculatedAmount)}
          </li>
        ))}
        {entry.deductions.map((d) => (
          <li key={`d-${d.id}`}>
            − {d.name}: {money(d.amount)}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Per-employee results of one payroll run. */
export function EntriesDialog({
  run,
  onClose,
}: {
  run: PayrollRun | null;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const query = useEntries(
    { page, limit: PAGE_SIZE, payrollRunId: run?.id ?? 0 },
    Boolean(run),
  );
  const rows = query.data?.data ?? [];

  return (
    <Dialog
      open={Boolean(run)}
      onClose={() => {
        setPage(1);
        onClose();
      }}
      title={
        run
          ? `Run #${run.runNumber} — ${periodLabel(run.payrollPeriod)}`
          : "Payroll entries"
      }
      className="max-w-5xl"
    >
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
                  cell: (r) =>
                    `${days(r.payableDays)} / ${r.totalCalendarDays}`,
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
                { header: "Details", cell: (r) => <Breakdown entry={r} /> },
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
    </Dialog>
  );
}
