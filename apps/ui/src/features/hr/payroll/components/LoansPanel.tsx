"use client";

import { ApiError } from "@texawave-erp/core";
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
import { isoDate, money } from "../format";
import { useLoans, useMyLoans } from "../hooks";
import { LOAN_READ, LOAN_WRITE, MY_LOAN_READ } from "../permissions";
import { LOAN_STATUSES, type Loan, type LoanStatus } from "../types";
import { IssueLoanDialog, LoanDetailDialog, outstanding } from "./LoanDialogs";
import { StatusPill, statusLabel } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 10;

function LoansTable({
  caption,
  rows,
  onOpen,
  showEmployee,
}: {
  caption: string;
  rows: Loan[];
  onOpen: (loan: Loan) => void;
  showEmployee: boolean;
}) {
  return (
    <DataTable<Loan>
      caption={caption}
      rows={rows}
      getRowKey={(r) => String(r.id)}
      columns={[
        { header: "Loan", cell: (r) => r.loanNumber },
        ...(showEmployee
          ? [
              {
                header: "Employee",
                cell: (r: Loan) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{r.employee.fullName}</span>
                    <span className="text-theme-xs text-gray-500">
                      {r.employee.employeeCode}
                    </span>
                  </div>
                ),
              },
            ]
          : []),
        {
          header: "Principal",
          cell: (r) => money(r.principalAmount),
          className: "text-right whitespace-nowrap",
          headerClassName: "text-right",
        },
        {
          header: "EMI",
          cell: (r) => `${money(r.emiAmount)} × ${r.emiMonths}`,
          className: "whitespace-nowrap",
        },
        {
          header: "Outstanding",
          cell: (r) => money(outstanding(r) / 100),
          className: "text-right whitespace-nowrap",
          headerClassName: "text-right",
        },
        { header: "Disbursed", cell: (r) => isoDate(r.disbursedDate) },
        {
          header: "Status",
          cell: (r) => {
            const pending = r.skipRequests.filter(
              (s) => s.status === "PENDING",
            ).length;
            return (
              <span className="flex flex-col items-start gap-1">
                <StatusPill status={r.status} />
                {pending > 0 ? (
                  <span className="text-theme-xs text-warning-700 dark:text-warning-300">
                    {pending} skip request{pending === 1 ? "" : "s"} pending
                  </span>
                ) : null}
              </span>
            );
          },
        },
        {
          header: "Actions",
          cell: (r) => (
            <Button
              size="sm"
              variant="secondary"
              aria-label={`View loan ${r.loanNumber}`}
              onClick={() => onOpen(r)}
            >
              View
            </Button>
          ),
        },
      ]}
    />
  );
}

/** The signed-in employee's own loans (read-only). Hidden for an account
 * with no employee record, as the other "My …" sections are. */
function MyLoansSection() {
  const canRead = usePermission(MY_LOAN_READ);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const query = useMyLoans({ page, limit: PAGE_SIZE }, canRead);
  const rows = query.data?.data ?? [];
  const open = rows.find((l) => l.id === openId) ?? null;

  if (!canRead) return null;
  if (
    query.error instanceof ApiError &&
    query.error.errorCode === "NOT_AN_EMPLOYEE"
  )
    return null;

  return (
    <section aria-labelledby="my-loans-heading" className="flex flex-col gap-3">
      <h2
        id="my-loans-heading"
        className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
      >
        My loans
      </h2>
      <QueryState query={query} area="your loans" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState title="No loans" description="You have no loans." />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <LoansTable
            caption="My loans"
            rows={rows}
            showEmployee={false}
            onOpen={(l) => setOpenId(l.id)}
          />
          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}
      {open ? (
        <LoanDetailDialog
          loan={open}
          selfService
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </section>
  );
}

function HrLoansSection() {
  const canRead = usePermission(LOAN_READ);
  const canWrite = usePermission(LOAN_WRITE);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<LoanStatus | "">("ACTIVE");
  const [issuing, setIssuing] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const query = useLoans(
    { page, limit: PAGE_SIZE, ...(status ? { status } : {}) },
    canRead,
  );
  const rows = query.data?.data ?? [];
  // Re-read from the refetched list, so the schedule and skip requests in
  // the open dialog update after a decision.
  const open = rows.find((l) => l.id === openId) ?? null;

  if (!canRead) return null;

  return (
    <section aria-labelledby="hr-loans-heading" className="flex flex-col gap-3">
      <h2
        id="hr-loans-heading"
        className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
      >
        Employee loans
      </h2>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select
            aria-label="Filter by loan status"
            className="w-44"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as LoanStatus | "");
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {LOAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>
          {canWrite ? (
            <Button onClick={() => setIssuing(true)}>Issue loan</Button>
          ) : null}
        </div>
      </Card>
      <QueryState query={query} area="loans" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No loans"
            description={
              status
                ? `No ${statusLabel(status).toLowerCase()} loans.`
                : "No loans have been issued."
            }
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <LoansTable
            caption="Employee loans"
            rows={rows}
            showEmployee
            onOpen={(l) => setOpenId(l.id)}
          />
          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}
      {issuing ? <IssueLoanDialog onClose={() => setIssuing(false)} /> : null}
      {open ? (
        <LoanDetailDialog loan={open} onClose={() => setOpenId(null)} />
      ) : null}
    </section>
  );
}

/** HR → Payroll → Loans: the employee's own loans, then (for HR) every loan
 * in scope with issuing, schedules and EMI-skip decisions. */
export function LoansPanel() {
  return (
    <div className="flex flex-col gap-6">
      <MyLoansSection />
      <HrLoansSection />
    </div>
  );
}
