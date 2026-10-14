"use client";

import {
  Alert,
  Button,
  DataTable,
  FormField,
  Input,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { describeError, isoDate, money } from "../format";
import {
  useDecideLoan,
  useDecideLoanPrepayment,
  useRequestLoanPrepayment,
  useReviewLoan,
} from "../hooks";
import { LOAN_APPROVE, LOAN_APPROVE_ALL, LOAN_REVIEW } from "../permissions";
import { LOAN_PENDING, type Loan, type LoanPrepayment } from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { StatusPill } from "./PayrollStatusBadge";

/**
 * Where a loan request stands (Docs/PAYROLL_AND_COMPLIANCE.md §3.7):
 * requested → HR review → final approval. Shown to HR and to the employee.
 */
export function LoanStages({ loan }: { loan: Loan }) {
  const rejectedAtHr =
    loan.status === "REJECTED" && !loan.approver && Boolean(loan.hrReviewer);
  const reviewed = loan.status !== "PENDING_HR";
  const decided = !LOAN_PENDING.includes(loan.status) && !rejectedAtHr;
  const stages: Array<{ label: string; detail: string; state: StageState }> = [
    {
      label: "Requested",
      detail: `${loan.requestedVia === "SELF" ? "By the employee" : "By HR"} · ${isoDate(loan.createdAt)}`,
      state: "done",
    },
    {
      label: "HR review",
      detail: loan.hrReviewer
        ? `${rejectedAtHr ? "Rejected" : "Forwarded"} by ${loan.hrReviewer.fullName} · ${isoDate(loan.hrReviewedAt)}${loan.hrReviewNote ? ` — ${loan.hrReviewNote}` : ""}`
        : reviewed
          ? "—"
          : "Waiting",
      state: rejectedAtHr ? "rejected" : reviewed ? "done" : "current",
    },
    {
      label: "Final approval",
      detail: loan.approver
        ? `${loan.status === "REJECTED" ? "Rejected" : "Approved"} by ${loan.approver.fullName} · ${isoDate(loan.approvedAt)}${loan.decisionNote ? ` — ${loan.decisionNote}` : ""}`
        : loan.status === "PENDING_ADMIN"
          ? "Waiting"
          : "—",
      state:
        loan.status === "PENDING_ADMIN"
          ? "current"
          : decided && loan.status === "REJECTED"
            ? "rejected"
            : decided
              ? "done"
              : "todo",
    },
  ];
  return (
    <ol
      aria-label="Approval steps"
      className="flex flex-col gap-2 sm:flex-row sm:gap-6"
    >
      {stages.map((s, i) => (
        <li key={s.label} className="flex flex-1 gap-2">
          <span
            aria-hidden
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-theme-xs font-semibold ${STAGE_DOT[s.state]}`}
          >
            {s.state === "done" ? "✓" : s.state === "rejected" ? "✕" : i + 1}
          </span>
          <span className="flex flex-col">
            <span className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
              {s.label}
              <span className="sr-only"> — {STAGE_TEXT[s.state]}</span>
            </span>
            <span className="text-theme-xs text-gray-600 dark:text-gray-400">
              {s.detail}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

type StageState = "done" | "current" | "rejected" | "todo";
const STAGE_DOT: Record<StageState, string> = {
  done: "bg-success-500 text-white",
  current: "bg-warning-500 text-white",
  rejected: "bg-error-500 text-white",
  todo: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};
const STAGE_TEXT: Record<StageState, string> = {
  done: "done",
  current: "in progress",
  rejected: "rejected",
  todo: "not yet",
};

/**
 * The two approval steps of a loan request (Docs/PAYROLL_AND_COMPLIANCE.md
 * §3.7): an HR reviewer forwards or rejects it, then a final approver
 * approves (builds the EMI schedule) or rejects it. Maker-checker, mirrored
 * from the API: never the person who recorded it or the borrower, and the
 * final approver is never the HR reviewer; a loan above the principal limit
 * needs an organization-wide final approver.
 */
export function LoanDecision({ loan }: { loan: Loan }) {
  const canReview = usePermission(LOAN_REVIEW);
  const canApprove = usePermission(LOAN_APPROVE);
  const canApproveAll = usePermission(LOAN_APPROVE_ALL);
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const review = useReviewLoan();
  const decide = useDecideLoan();
  const { toast } = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!LOAN_PENDING.includes(loan.status)) {
    return loan.hrReviewer || loan.approver ? <LoanStages loan={loan} /> : null;
  }

  const atReview = loan.status === "PENDING_HR";
  const allowed = atReview ? canReview : canApprove;
  const isMine =
    userId != null &&
    (loan.createdBy === userId || loan.employee.userId === userId);
  const reviewedIt =
    !atReview && userId != null && loan.hrReviewer?.id === userId;
  const needsOrgWide =
    !atReview && Boolean(loan.limitOverride) && !canApproveAll;
  const pending = review.isPending || decide.isPending;

  async function run(accept: boolean) {
    if (!accept && note.trim().length < 3) {
      setError("Give a reason for rejecting (at least 3 characters).");
      return;
    }
    setError(null);
    const trimmed = note.trim() || undefined;
    try {
      if (atReview) {
        await review.mutateAsync({
          id: loan.id,
          decision: accept ? "FORWARD" : "REJECT",
          note: trimmed,
        });
      } else {
        await decide.mutateAsync({
          id: loan.id,
          decision: accept ? "APPROVED" : "REJECTED",
          note: trimmed,
        });
      }
      toast({
        title: !accept
          ? `Loan ${loan.loanNumber} rejected`
          : atReview
            ? `Loan ${loan.loanNumber} forwarded for final approval`
            : `Loan ${loan.loanNumber} approved — EMI schedule created`,
        variant: "success",
      });
      setRejecting(false);
      setNote("");
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <section
      aria-label="Loan approval"
      className="flex flex-col gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-500/10"
    >
      <LoanStages loan={loan} />
      <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
        {atReview
          ? "Awaiting HR review — forward it for final approval or reject it."
          : "Awaiting final approval — the EMI schedule is created when it is approved."}
      </p>
      {loan.limitOverride ? (
        <Alert variant="warning" title="Above the loan limit">
          {loan.overrideReason ?? "Override requested."} Only an
          organization-wide approver may give the final approval.
        </Alert>
      ) : null}
      {!allowed ? null : isMine ? (
        <span className="text-theme-xs text-gray-600 dark:text-gray-400">
          You recorded this loan or it is yours — someone else must decide
        </span>
      ) : reviewedIt ? (
        <span className="text-theme-xs text-gray-600 dark:text-gray-400">
          You reviewed this loan — someone else must give the final approval
        </span>
      ) : needsOrgWide ? (
        <span className="text-theme-xs text-gray-600 dark:text-gray-400">
          Needs an organization-wide approver
        </span>
      ) : (
        <>
          {rejecting ? (
            <FormField label="Reason for rejecting" required>
              {(f) => (
                <Textarea
                  {...f}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
            </FormField>
          ) : atReview ? (
            <FormField label="Note" hint="Optional — shown to the approver.">
              {(f) => (
                <Textarea
                  {...f}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
            </FormField>
          ) : null}
          <div className="flex gap-2">
            {!rejecting ? (
              <Button
                size="sm"
                loading={pending}
                onClick={() => void run(true)}
              >
                {atReview ? "Forward for approval" : "Approve loan"}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => (rejecting ? void run(false) : setRejecting(true))}
            >
              {rejecting ? "Confirm reject" : "Reject"}
            </Button>
            {rejecting ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRejecting(false)}
              >
                Back
              </Button>
            ) : null}
          </div>
        </>
      )}
      <ServerError message={error} />
    </section>
  );
}

/** Record money repaid outside payroll; it settles nothing until a second
 * person approves it (then the last EMIs are settled first). */
export function PrepaymentForm({
  loan,
  outstandingRupees,
  onDone,
}: {
  loan: Loan;
  outstandingRupees: number;
  onDone: () => void;
}) {
  const request = useRequestLoanPrepayment();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [receivedOn, setReceivedOn] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const value = Number(amount);
    if (!(value >= 1)) next.amount = "Enter an amount of at least ₹1";
    else if (value > outstandingRupees)
      next.amount = `At most the outstanding ${money(outstandingRupees)}`;
    if (!receivedOn) next.receivedOn = "Choose the date it was received";
    if (reason.trim().length < 3)
      next.reason = "Give a reason (at least 3 characters)";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setServerError(null);
    try {
      await request.mutateAsync({
        loanId: loan.id,
        body: {
          amount: value,
          receivedOn,
          reference: reference.trim() || undefined,
          reason: reason.trim(),
        },
      });
      toast({
        title: "Prepayment recorded — awaiting approval",
        variant: "success",
      });
      onDone();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Record a prepayment"
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <p className="text-theme-sm text-gray-700 dark:text-gray-300">
        Once approved, the amount settles the last EMIs first, so the loan ends
        sooner and the monthly EMI stays the same.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Amount (₹)" required error={errors.amount}>
          {(f) => (
            <Input
              {...f}
              type="number"
              min={1}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Received on" required error={errors.receivedOn}>
          {(f) => (
            <Input
              {...f}
              type="date"
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Reference" hint="Optional, e.g. a receipt number.">
          {(f) => (
            <Input
              {...f}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
        </FormField>
      </div>
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
        submitLabel="Record prepayment"
      />
    </form>
  );
}

function PrepaymentDecision({
  prepayment,
  loan,
  selfService,
}: {
  prepayment: LoanPrepayment;
  loan: Loan;
  selfService: boolean;
}) {
  const canApprove = usePermission(LOAN_APPROVE);
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const decide = useDecideLoanPrepayment();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  if (prepayment.status !== "PENDING") {
    return prepayment.decider ? (
      <span className="text-theme-xs text-gray-600 dark:text-gray-400">
        by {prepayment.decider.fullName}
      </span>
    ) : null;
  }
  if (selfService || !canApprove) return null;
  const isMine =
    userId != null &&
    (prepayment.requestedById === userId || loan.employee.userId === userId);
  if (isMine) {
    return (
      <span className="text-theme-xs text-gray-600 dark:text-gray-400">
        Someone else must decide
      </span>
    );
  }

  async function run(decision: "APPROVED" | "REJECTED") {
    setError(null);
    try {
      await decide.mutateAsync({ id: prepayment.id, decision });
      toast({
        title:
          decision === "APPROVED"
            ? "Prepayment approved — EMIs settled"
            : "Prepayment rejected",
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

export function PrepaymentsTable({
  loan,
  selfService,
}: {
  loan: Loan;
  selfService: boolean;
}) {
  const rows = loan.prepayments ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-theme-sm text-gray-600 dark:text-gray-400">
        No prepayments.
      </p>
    );
  }
  return (
    <DataTable
      caption="Prepayments"
      rows={rows}
      getRowKey={(r) => String(r.id)}
      columns={[
        { header: "Received", cell: (r) => isoDate(r.receivedOn) },
        {
          header: "Amount",
          cell: (r) => money(r.amount),
          className: "text-right whitespace-nowrap",
          headerClassName: "text-right",
        },
        { header: "Reference", cell: (r) => r.reference ?? "—" },
        { header: "Reason", cell: (r) => r.reason },
        {
          header: "Recorded by",
          cell: (r) => r.requester?.fullName ?? "—",
        },
        { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
        {
          header: "Decision",
          cell: (r) => (
            <PrepaymentDecision
              prepayment={r}
              loan={loan}
              selfService={selfService}
            />
          ),
        },
      ]}
    />
  );
}
