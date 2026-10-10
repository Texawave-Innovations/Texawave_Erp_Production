"use client";

import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { isoDate, periodLabel, timestamp } from "../format";
import { usePeriods, useRuns } from "../hooks";
import {
  PAYROLL_APPROVE,
  PAYROLL_FINALIZE,
  PAYROLL_WRITE,
} from "../permissions";
import {
  PERIOD_STATUSES,
  type PayrollPeriod,
  type PayrollRun,
  type PeriodStatus,
} from "../types";
import { EntriesDialog } from "./EntriesDialog";
import { PayrollLifecycle } from "./PayrollLifecycle";
import { PayrollStatusBadge, periodStatusLabel } from "./PayrollStatusBadge";
import {
  ApproveRunDialog,
  ConfirmPeriodDialog,
  CreatePeriodDialog,
  RunPayrollDialog,
} from "./PeriodDialogs";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 12;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + 1 - i);

/** Payroll lifecycle for one period: run → approve (another person) →
 * finalize (generates payslips, locks the period). */
function PeriodDetail({
  period,
  onClose,
}: {
  period: PayrollPeriod;
  onClose: () => void;
}) {
  const canWrite = usePermission(PAYROLL_WRITE);
  const canApprove = usePermission(PAYROLL_APPROVE);
  const canFinalize = usePermission(PAYROLL_FINALIZE);
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const runs = useRuns({ page: 1, limit: 50, payrollPeriodId: period.id });
  const [runOpen, setRunOpen] = useState(false);
  const [confirm, setConfirm] = useState<"finalize" | "cancel" | null>(null);
  const [approving, setApproving] = useState<PayrollRun | null>(null);
  const [viewing, setViewing] = useState<PayrollRun | null>(null);

  const locked = period.status === "FINALIZED" || period.status === "CANCELLED";
  const rows = runs.data?.data ?? [];
  const hasApprovedRun = rows.some((r) => r.status === "APPROVED");

  return (
    <Card>
      <section
        aria-labelledby="period-detail-heading"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="period-detail-heading"
              className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
            >
              {periodLabel(period)}
            </h2>
            <p className="text-theme-sm text-gray-600 dark:text-gray-400">
              {isoDate(period.periodStart)} – {isoDate(period.periodEnd)} ·{" "}
              <PayrollStatusBadge status={period.status} />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWrite && !locked ? (
              <Button onClick={() => setRunOpen(true)}>Run payroll</Button>
            ) : null}
            {canFinalize && !locked ? (
              <Button
                variant="secondary"
                disabled={!hasApprovedRun}
                title={
                  hasApprovedRun ? undefined : "Approve a run before finalizing"
                }
                onClick={() => setConfirm("finalize")}
              >
                Finalize
              </Button>
            ) : null}
            {canWrite && !locked ? (
              <Button variant="ghost" onClick={() => setConfirm("cancel")}>
                Cancel period
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {runs.isSuccess ? (
          <PayrollLifecycle period={period} runs={rows} />
        ) : null}

        <QueryState query={runs} area="payroll runs" />
        {runs.isSuccess && rows.length === 0 ? (
          <EmptyState
            title="No runs yet"
            description={
              canWrite && !locked
                ? "Run payroll to calculate this period."
                : "Payroll has not been run for this period."
            }
          />
        ) : null}
        {runs.isSuccess && rows.length > 0 ? (
          <DataTable<PayrollRun>
            caption="Payroll runs"
            rows={rows}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Run", cell: (r) => `#${r.runNumber}` },
              {
                header: "Status",
                cell: (r) => (
                  <span className="flex flex-col items-start gap-0.5">
                    <PayrollStatusBadge status={r.status} />
                    {r.status === "CANCELLED" ? (
                      <span className="text-theme-xs text-gray-500">
                        Replaced by a later run
                      </span>
                    ) : null}
                  </span>
                ),
              },
              { header: "Employees", cell: (r) => r._count.entries },
              {
                header: "Run by",
                cell: (r) => (
                  <span className="flex flex-col">
                    <span>{r.runCreator?.fullName ?? "—"}</span>
                    <span className="text-theme-xs text-gray-500">
                      {timestamp(r.completedAt ?? r.startedAt)}
                    </span>
                  </span>
                ),
              },
              {
                header: "Notes",
                cell: (r) =>
                  r.notes ? (
                    <span className="line-clamp-2 max-w-48" title={r.notes}>
                      {r.notes}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Approved by",
                cell: (r) =>
                  r.runApprover
                    ? `${r.runApprover.fullName} · ${isoDate(r.approvedAt)}`
                    : "—",
              },
              {
                header: "Actions",
                cell: (r) => (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setViewing(r)}
                    >
                      View entries
                    </Button>
                    {canApprove && r.status === "PROCESSED" && !locked ? (
                      // Maker-checker, mirrored from the API: the run's
                      // creator may not approve it.
                      r.runCreator && r.runCreator.id === userId ? (
                        <span className="text-theme-xs text-gray-600 dark:text-gray-400">
                          You ran this — someone else must approve
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => setApproving(r)}>
                          Approve
                        </Button>
                      )
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        ) : null}
      </section>

      {/* Every dialog mounts only while open: ui-kit's Dialog uses a fixed
          `id="dialog-title"`, so two mounted dialogs share one accessible
          name. Remove this note once Dialog generates its id with useId(). */}
      {runOpen ? (
        <RunPayrollDialog
          open
          onClose={() => setRunOpen(false)}
          period={period}
        />
      ) : null}
      {confirm ? (
        <ConfirmPeriodDialog
          open
          onClose={() => setConfirm(null)}
          period={period}
          action={confirm}
        />
      ) : null}
      {approving ? (
        <ApproveRunDialog
          open
          onClose={() => setApproving(null)}
          run={approving}
        />
      ) : null}
      {viewing ? (
        <EntriesDialog run={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </Card>
  );
}

export function PeriodsPanel() {
  const canWrite = usePermission(PAYROLL_WRITE);
  const [page, setPage] = useState(1);
  const [year, setYear] = useState<number | "">(CURRENT_YEAR);
  const [status, setStatus] = useState<PeriodStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const query = usePeriods({
    page,
    limit: PAGE_SIZE,
    ...(year ? { year } : {}),
    ...(status ? { status } : {}),
  });
  const rows = query.data?.data ?? [];
  // Read the selected period from the (refetched) list so its status and
  // runs stay current after an action.
  const selected = rows.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Select
              aria-label="Filter by year"
              className="w-36"
              value={year}
              onChange={(e) => {
                setYear(e.target.value ? Number(e.target.value) : "");
                setPage(1);
              }}
            >
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by status"
              className="w-full sm:w-44"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as PeriodStatus | "");
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {PERIOD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {periodStatusLabel(s)}
                </option>
              ))}
            </Select>
          </div>
          {canWrite ? (
            <Button onClick={() => setCreateOpen(true)}>New period</Button>
          ) : null}
        </div>
      </Card>

      <QueryState query={query} area="payroll periods" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No payroll periods"
            description={
              canWrite
                ? "Create a period to start this month's payroll."
                : "No payroll periods match these filters."
            }
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <DataTable<PayrollPeriod>
            caption="Payroll periods"
            rows={rows}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Period",
                cell: (r) => (
                  <span className="font-medium">{periodLabel(r)}</span>
                ),
              },
              {
                header: "Dates",
                cell: (r) =>
                  `${isoDate(r.periodStart)} – ${isoDate(r.periodEnd)}`,
              },
              {
                header: "Status",
                cell: (r) => <PayrollStatusBadge status={r.status} />,
              },
              {
                header: "Latest run",
                cell: (r) => {
                  const latest = r.runs[0];
                  return latest ? (
                    <span className="flex items-center gap-2">
                      #{latest.runNumber}
                      <PayrollStatusBadge status={latest.status} />
                    </span>
                  ) : (
                    "—"
                  );
                },
              },
              {
                header: "Actions",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant={r.id === selectedId ? "primary" : "secondary"}
                    aria-pressed={r.id === selectedId}
                    aria-label={`Manage ${periodLabel(r)}`}
                    onClick={() =>
                      setSelectedId(r.id === selectedId ? null : r.id)
                    }
                  >
                    Manage
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

      {selected ? (
        <PeriodDetail period={selected} onClose={() => setSelectedId(null)} />
      ) : null}

      {createOpen ? (
        <CreatePeriodDialog
          open
          onClose={() => setCreateOpen(false)}
          onCreated={(p) => {
            setYear(p.year);
            setStatus("");
            setPage(1);
            setSelectedId(p.id);
          }}
        />
      ) : null}
    </div>
  );
}
