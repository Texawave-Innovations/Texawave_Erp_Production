"use client";

import {
  Button,
  DataTable,
  Dialog,
  FormField,
  Input,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { describeError, isoDate, money, periodLabel } from "../format";
import { useCreateLoan, useDecideLoanSkip, useRequestLoanSkip } from "../hooks";
import { LOAN_APPROVE, LOAN_WRITE } from "../permissions";
import { createLoanSchema, fieldErrors, loanSkipSchema } from "../schema";
import type { Loan, LoanSkipRequest } from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { OpenPeriodSelect } from "./OpenPeriodSelect";
import { StatusPill } from "./PayrollStatusBadge";

/** Remaining (still PENDING) installments, in paise-safe rupees. */
export function outstanding(loan: Loan): number {
  return loan.repayments
    .filter((r) => r.status === "PENDING")
    .reduce((sum, r) => sum + Math.round(Number(r.amount) * 100), 0);
}

// ---- issue a loan ---------------------------------------------------------

export function IssueLoanDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateLoan();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [principal, setPrincipal] = useState("");
  const [emi, setEmi] = useState("");
  const [months, setMonths] = useState("");
  const [disbursed, setDisbursed] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Suggest an EMI that repays in the chosen months (rounded up, so the
  // schedule always covers the principal — the last installment absorbs it).
  const suggestion =
    Number(principal) > 0 && Number(months) > 0
      ? Math.ceil(Number(principal) / Number(months))
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createLoanSchema.safeParse({
      employeeId: employee?.id,
      principalAmount: principal,
      emiAmount: emi,
      emiMonths: months,
      disbursedDate: disbursed,
      reason,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      const loan = await create.mutateAsync(parsed.data);
      toast({
        title: `Loan ${loan.loanNumber} issued to ${employee?.fullName}`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Issue loan">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Employee" required error={errors.employeeId}>
          {(f) => (
            <EmployeePicker {...f} value={employee} onChange={setEmployee} />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label="Principal (₹)"
            required
            error={errors.principalAmount}
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={1}
                inputMode="decimal"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Months" required error={errors.emiMonths}>
            {(f) => (
              <Input
                {...f}
                type="number"
                min={1}
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="EMI (₹)"
            required
            error={errors.emiAmount}
            hint={
              suggestion
                ? `Suggested: ₹${suggestion.toLocaleString("en-IN")}`
                : undefined
            }
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={1}
                inputMode="decimal"
                value={emi}
                onChange={(e) => setEmi(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField
          label="Disbursed on"
          required
          hint="The first EMI is due one month later."
          error={errors.disbursedDate}
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              value={disbursed}
              onChange={(e) => setDisbursed(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Reason" hint="Optional." error={errors.reason}>
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Issue loan"
        />
      </form>
    </Dialog>
  );
}

// ---- loan detail: schedule, skip requests ---------------------------------

function SkipRequestForm({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const request = useRequestLoanSkip();
  const { toast } = useToast();
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loanSkipSchema.safeParse({
      payrollPeriodId: periodId ?? undefined,
      reason,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await request.mutateAsync({ loanId: loan.id, body: parsed.data });
      toast({ title: "EMI skip requested", variant: "success" });
      onDone();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Request an EMI skip"
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <p className="text-theme-sm text-gray-700 dark:text-gray-300">
        The skipped EMI is moved to the end of the schedule, so the loan is
        still fully recovered. Another person must approve the request.
      </p>
      <FormField label="Payroll period" required error={errors.payrollPeriodId}>
        {(f) => (
          <OpenPeriodSelect
            {...f}
            value={periodId}
            onChange={setPeriodId}
            emptyLabel="Choose a period"
          />
        )}
      </FormField>
      <FormField label="Reason" required error={errors.reason}>
        {(f) => (
          <Textarea
            {...f}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </FormField>
      <ServerError message={serverError} />
      <DialogActions
        onCancel={onDone}
        submitting={request.isPending}
        submitLabel="Request skip"
      />
    </form>
  );
}

function SkipDecision({ skip, loan }: { skip: LoanSkipRequest; loan: Loan }) {
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const canApprove = usePermission(LOAN_APPROVE);
  const decide = useDecideLoanSkip();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  // Maker-checker, mirrored from the API: neither the requester nor the
  // borrower may decide it.
  const isMine =
    userId != null &&
    (skip.requester?.id === userId || loan.employee.userId === userId);

  if (skip.status !== "PENDING") {
    return skip.approver ? (
      <span className="text-theme-xs text-gray-600 dark:text-gray-400">
        by {skip.approver.fullName}
      </span>
    ) : null;
  }
  if (!canApprove) return null;
  if (isMine)
    return (
      <span className="text-theme-xs text-gray-600 dark:text-gray-400">
        Someone else must decide
      </span>
    );

  async function run(decision: "APPROVED" | "REJECTED") {
    setError(null);
    try {
      await decide.mutateAsync({ id: skip.id, decision });
      toast({
        title: decision === "APPROVED" ? "Skip approved" : "Skip rejected",
        variant: "success",
      });
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={decide.isPending}
          onClick={() => void run("APPROVED")}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={decide.isPending}
          onClick={() => void run("REJECTED")}
        >
          Reject
        </Button>
      </div>
      <ServerError message={error} />
    </div>
  );
}

export function LoanDetailDialog({
  loan,
  onClose,
  selfService = false,
}: {
  loan: Loan;
  onClose: () => void;
  /** Employee's own view: read-only. */
  selfService?: boolean;
}) {
  const canWrite = usePermission(LOAN_WRITE) && !selfService;
  const [requesting, setRequesting] = useState(false);
  const paid = loan.repayments.filter((r) => r.status === "PAID").length;
  const total = loan.repayments.filter((r) => r.status !== "SKIPPED").length;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Loan ${loan.loanNumber}`}
      className="max-w-4xl"
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              [
                "Employee",
                `${loan.employee.fullName} (${loan.employee.employeeCode})`,
              ],
              ["Principal", money(loan.principalAmount)],
              ["EMI", `${money(loan.emiAmount)} × ${loan.emiMonths}`],
              ["Outstanding", money(outstanding(loan) / 100)],
              ["Disbursed", isoDate(loan.disbursedDate)],
              ["Repaid", `${paid} of ${total} installments`],
              ["Status", <StatusPill key="s" status={loan.status} />],
              ["Reason", loan.reason ?? "—"],
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

        <DataTable
          caption="Repayment schedule"
          rows={loan.repayments}
          getRowKey={(r) => String(r.id)}
          columns={[
            { header: "#", cell: (r) => r.installmentNo },
            { header: "Due", cell: (r) => isoDate(r.dueDate) },
            {
              header: "Amount",
              cell: (r) => money(r.amount),
              className: "text-right whitespace-nowrap",
              headerClassName: "text-right",
            },
            { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
            { header: "Paid on", cell: (r) => isoDate(r.paidAt) },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-theme-md font-semibold text-gray-900 dark:text-white/90">
            EMI skip requests
          </h3>
          {canWrite && loan.status === "ACTIVE" && !requesting ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRequesting(true)}
            >
              Request EMI skip
            </Button>
          ) : null}
        </div>
        {requesting ? (
          <SkipRequestForm loan={loan} onDone={() => setRequesting(false)} />
        ) : null}
        {loan.skipRequests.length === 0 ? (
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">
            No skip requests.
          </p>
        ) : (
          <DataTable
            caption="EMI skip requests"
            rows={loan.skipRequests}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Period", cell: (r) => periodLabel(r.payrollPeriod) },
              { header: "Reason", cell: (r) => r.reason },
              {
                header: "Requested by",
                cell: (r) =>
                  `${r.requester?.fullName ?? "—"} · ${isoDate(r.requestedAt)}`,
              },
              {
                header: "Status",
                cell: (r) => <StatusPill status={r.status} />,
              },
              {
                header: "Decision",
                cell: (r) =>
                  selfService ? null : <SkipDecision skip={r} loan={loan} />,
              },
            ]}
          />
        )}
      </div>
    </Dialog>
  );
}
