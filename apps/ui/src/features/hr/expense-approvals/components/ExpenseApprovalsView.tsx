"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useExpenseClaims, useMyExpenseClaims } from "../hooks";
import {
  DECIDE_ANY_SCOPE,
  READ_ANY_SCOPE,
  SELF_SERVICE_CREATE,
  SELF_SERVICE_READ,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import {
  EXPENSE_CLAIM_STATUSES,
  EXPENSE_TYPES,
  type ExpenseClaimItem,
  type ExpenseClaimStatus,
  type ExpenseType,
} from "../types";
import { DecideExpenseClaimDialog } from "./DecideExpenseClaimDialog";
import { ExpenseClaimStatusBadge } from "./ExpenseClaimStatusBadge";
import { SubmitExpenseClaimDialog } from "./SubmitExpenseClaimDialog";

const PAGE_SIZE = 10;

interface Filters {
  status: "" | ExpenseClaimStatus;
  expenseType: "" | ExpenseType;
  employeeId: string;
}
const EMPTY_FILTERS: Filters = { status: "", expenseType: "", employeeId: "" };

type Decision = {
  claim: ExpenseClaimItem;
  decision: "APPROVED" | "REJECTED";
} | null;

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/** My expenses: submit and history. */
function MySection() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const [page, setPage] = useState(1);
  const [submitOpen, setSubmitOpen] = useState(false);
  const list = useMyExpenseClaims({ page, limit: PAGE_SIZE });

  if (!canRead) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          My expense claims
        </h2>
        {canCreate ? (
          <Button onClick={() => setSubmitOpen(true)}>
            Submit expense claim
          </Button>
        ) : null}
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No expense claims yet"
            description={
              canCreate
                ? "Submit an expense claim to see it here."
                : "Your expense claim history will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="My expense claims"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Type", cell: (r) => r.expenseType },
              { header: "Amount", cell: (r) => formatAmount(r.amount) },
              { header: "Date", cell: (r) => r.expenseDate },
              { header: "Description", cell: (r) => r.description },
              {
                header: "Status",
                cell: (r) => <ExpenseClaimStatusBadge status={r.status} />,
              },
              {
                header: "Note",
                cell: (r) => r.decisionNote ?? "—",
              },
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {submitOpen ? (
        <SubmitExpenseClaimDialog open onClose={() => setSubmitOpen(false)} />
      ) : null}
    </div>
  );
}

/** HR/approver queue: team/all scope, filterable, approve/reject. */
function ApprovalsSection() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const canDecide = usePermission(DECIDE_ANY_SCOPE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [decision, setDecision] = useState<Decision>(null);

  const employeeIdNum = Number(filters.employeeId);
  const hasValidEmployeeId =
    filters.employeeId !== "" &&
    Number.isInteger(employeeIdNum) &&
    employeeIdNum > 0;

  const query = {
    page,
    limit: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.expenseType ? { expenseType: filters.expenseType } : {}),
    ...(hasValidEmployeeId ? { employeeId: employeeIdNum } : {}),
  };

  const list = useExpenseClaims(query, canRead);
  const hasFilters =
    filters.status !== "" ||
    filters.expenseType !== "" ||
    filters.employeeId !== "";

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  if (!canRead) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Expense claims (team / organization)
          </h2>
          {list.data ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {hasFilters
                ? `Showing ${list.data.meta.total} matching claims`
                : `${list.data.meta.total} claims`}
            </p>
          ) : null}
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              update("status", e.target.value as "" | ExpenseClaimStatus)
            }
          >
            <option value="">All statuses</option>
            {EXPENSE_CLAIM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by expense type"
            value={filters.expenseType}
            onChange={(e) =>
              update("expenseType", e.target.value as "" | ExpenseType)
            }
          >
            <option value="">All types</option>
            {EXPENSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min="1"
            aria-label="Filter by employee ID"
            placeholder="Employee ID"
            value={filters.employeeId}
            onChange={(e) => update("employeeId", e.target.value)}
          />
        </div>
        {hasFilters ? (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to expense claims"
          >
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={
              hasFilters
                ? "No claims match these filters"
                : "No expense claims yet"
            }
            description={
              hasFilters
                ? "Try a different status, type or employee, or clear the filters."
                : "Claims from your team will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Expense claims"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Employee", cell: (r) => r.employee.fullName },
              { header: "Type", cell: (r) => r.expenseType },
              { header: "Amount", cell: (r) => formatAmount(r.amount) },
              { header: "Date", cell: (r) => r.expenseDate },
              {
                header: "Status",
                cell: (r) => <ExpenseClaimStatusBadge status={r.status} />,
              },
              {
                header: "Decided by",
                cell: (r) => r.decidedBy?.fullName ?? "—",
              },
              ...(canDecide
                ? [
                    {
                      header: "Actions",
                      cell: (r: ExpenseClaimItem) =>
                        r.status === "PENDING" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                setDecision({ claim: r, decision: "APPROVED" })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setDecision({ claim: r, decision: "REJECTED" })
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          "—"
                        ),
                    },
                  ]
                : []),
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {decision ? (
        <DecideExpenseClaimDialog
          open
          onClose={() => setDecision(null)}
          claim={decision.claim}
          decision={decision.decision}
        />
      ) : null}
    </div>
  );
}

/**
 * Expense Approvals: self-service (submit, history) and the HR/approver
 * queue (team/all, filterable, approve/reject with an optional note), on one
 * route — mirrors Leaves' single scoped view rather than a split
 * self-service/HR route, since decision and the employee's own claims
 * naturally sit on the same page.
 */
export function ExpenseApprovalsView() {
  const canReadMine = usePermission(SELF_SERVICE_READ);
  const canReadAny = usePermission(READ_ANY_SCOPE);

  if (!canReadMine && !canReadAny) {
    return (
      <Alert variant="warning" title="You don't have access to expense claims">
        Ask an administrator for the{" "}
        <code>employee_self_service.expense_claim.read</code> or{" "}
        <code>hr.expense_claim.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Expense Approvals
      </h1>
      <MySection />
      {canReadMine && canReadAny ? (
        <hr className="border-gray-200 dark:border-gray-800" />
      ) : null}
      <ApprovalsSection />
    </div>
  );
}
