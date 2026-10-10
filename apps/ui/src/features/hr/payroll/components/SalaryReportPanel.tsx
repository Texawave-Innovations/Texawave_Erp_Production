"use client";

import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import { useMemo, useState } from "react";
import { periodLabel } from "../format";
import { downloadText } from "../download";
import { useAllRunEntries, usePeriods } from "../hooks";
import {
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
  return period.runs
    .filter((r) => r.status === "APPROVED" || r.status === "PROCESSED")
    .sort((a, b) =>
      a.status === b.status
        ? b.runNumber - a.runNumber
        : a.status === "APPROVED"
          ? -1
          : 1,
    );
}

const money = (k: keyof SalaryReportRow) => ({
  className: "text-right whitespace-nowrap",
  headerClassName: "text-right",
  cell: (r: SalaryReportRow) => rupees(r[k] as number),
});

/**
 * HR → Payroll → Salary report: one row per employee for a period's run,
 * with totals and CSV export. Reads the saved run (GET /hr/payroll/entries)
 * — it never recalculates pay, so it always matches Payroll and payslips.
 */
export function SalaryReportPanel() {
  const periods = usePeriods({ page: 1, limit: 100 });
  const usable = (periods.data?.data ?? []).filter(
    (p) => p.status !== "CANCELLED" && reportableRuns(p).length > 0,
  );

  const [periodId, setPeriodId] = useState<number | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  // A team/department chosen for one run may not exist in the next.
  const resetFilters = () => {
    setTeamId(null);
    setDepartmentId(null);
  };

  const period = usable.find((p) => p.id === periodId) ?? usable[0];
  const runs = reportableRuns(period);
  const run = runs.find((r) => r.id === runId) ?? reportRun(runs);

  const entries = useAllRunEntries(run?.id ?? null);
  const allRows = useMemo(
    () => (entries.data ?? []).map(toReportRow),
    [entries.data],
  );
  const teams = optionsOf(allRows, "team");
  const departments = optionsOf(allRows, "department");
  const needle = search.trim().toLowerCase();
  const filtering = Boolean(needle || teamId || departmentId);
  const rows = allRows.filter(
    (r) =>
      (!teamId || r.team?.id === teamId) &&
      (!departmentId || r.department?.id === departmentId) &&
      (!needle ||
        r.fullName.toLowerCase().includes(needle) ||
        r.employeeCode.toLowerCase().includes(needle)),
  );
  const totals = totalsOf(rows);
  const meta =
    period && run
      ? { year: period.year, month: period.month, runNumber: run.runNumber }
      : null;

  if (periods.isPending || periods.isError) {
    return <QueryState query={periods} area="payroll periods" />;
  }
  if (!period || !run || !meta) {
    return (
      <Card>
        <EmptyState
          title="No payroll to report on"
          description="Run payroll for a period first. The report reads the approved run, or the latest processed run if none is approved yet."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-48">
            <FormField label="Period">
              {(f) => (
                <Select
                  {...f}
                  value={period.id}
                  onChange={(e) => {
                    setPeriodId(Number(e.target.value));
                    setRunId(null);
                    resetFilters();
                  }}
                >
                  {usable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {periodLabel(p)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <div className="w-56">
            <FormField label="Run">
              {(f) => (
                <Select
                  {...f}
                  value={run.id}
                  onChange={(e) => {
                    setRunId(Number(e.target.value));
                    resetFilters();
                  }}
                >
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      Run #{r.runNumber} —{" "}
                      {r.status === "APPROVED" ? "Approved" : "Processed"}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-48">
            <FormField label="Team">
              {(f) => (
                <Select
                  {...f}
                  value={teamId ?? ""}
                  disabled={teams.length === 0}
                  onChange={(e) =>
                    setTeamId(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">All teams</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-48">
            <FormField label="Department">
              {(f) => (
                <Select
                  {...f}
                  value={departmentId ?? ""}
                  disabled={departments.length === 0}
                  onChange={(e) =>
                    setDepartmentId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-64">
            <FormField label="Search employees">
              {(f) => (
                <Input
                  {...f}
                  type="search"
                  placeholder="Name or code"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="ml-auto">
            <Button
              variant="secondary"
              disabled={!entries.isSuccess || rows.length === 0}
              onClick={() => {
                const csv = toCsv(meta, rows);
                downloadText(csv.fileName, csv.content);
              }}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {run.status !== "APPROVED" ? (
        <Alert variant="warning" title="Not yet approved">
          This run is processed but not approved, so these figures may still
          change.
        </Alert>
      ) : null}

      <section
        aria-labelledby="salary-report-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="salary-report-heading"
            className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
          >
            Salary report — {reportTitle(meta)}
          </h2>
          <PayrollStatusBadge status={run.status} />
        </div>

        <QueryState query={entries} area="payroll entries" />
        {entries.isSuccess ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["Employees", String(rows.length)],
                ["Gross", rupees(totals.gross)],
                ["Deductions", rupees(totals.totalDeductions)],
                ["Net payable", rupees(totals.net)],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
              >
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {label}
                </dt>
                <dd className="text-theme-md font-semibold text-gray-900 dark:text-white/90">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {entries.isSuccess && rows.length === 0 ? (
          <Card>
            <EmptyState
              title={filtering ? "No matching employees" : "No entries"}
              description={
                filtering
                  ? "No employee in this run matches these filters."
                  : "This run has no calculated employees."
              }
            />
          </Card>
        ) : null}

        {entries.isSuccess && rows.length > 0 ? (
          <>
            <DataTable<SalaryReportRow>
              caption="Salary report"
              rows={rows}
              getRowKey={(r) => String(r.entryId)}
              columns={[
                {
                  header: "Employee",
                  cell: (r) => (
                    <div className="flex flex-col">
                      <span className="font-medium">{r.fullName}</span>
                      <span className="text-theme-xs text-gray-500">
                        {r.employeeCode}
                      </span>
                    </div>
                  ),
                },
                {
                  header: "Team / department",
                  cell: (r) => (
                    <div className="flex flex-col text-theme-xs">
                      <span>{r.team?.name ?? "—"}</span>
                      <span className="text-gray-500">
                        {r.department?.name ?? "—"}
                      </span>
                    </div>
                  ),
                },
                { header: "Payable days", cell: (r) => r.payableDays },
                { header: "LOP", cell: (r) => r.lopDays },
                { header: "Gross", ...money("gross") },
                { header: "PF", ...money("pf") },
                { header: "ESI", ...money("esi") },
                { header: "Loan EMI", ...money("loan") },
                { header: "Other", ...money("otherDeductions") },
                { header: "Net payable", ...money("net") },
              ]}
            />
            <p className="text-theme-xs text-gray-600 dark:text-gray-400">
              Totals: gross {rupees(totals.gross)} · PF {rupees(totals.pf)} ·
              ESI {rupees(totals.esi)} · loan EMI {rupees(totals.loan)} · other{" "}
              {rupees(totals.otherDeductions)} · net {rupees(totals.net)}
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
