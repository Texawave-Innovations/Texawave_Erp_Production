/**
 * Loan arithmetic as pure functions (Docs/PAYROLL_AND_COMPLIANCE.md §4.6).
 */

const cents = (n: number) => Math.round(n * 100);

/** Same day `months` later, clamped to the month end (31 Jan + 1 = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

/**
 * `emiMonths` installments of `emiAmount`, one month apart from
 * `disbursedOn`, the last adjusted to the remainder so the schedule sums to
 * exactly the principal. Returns null when the EMI does not fit (the last
 * installment would be zero/negative or larger than a regular one).
 */
export function buildSchedule(
  principal: number,
  emiAmount: number,
  emiMonths: number,
  disbursedOn: Date,
): Array<{ installmentNo: number; dueDate: Date; amount: number }> | null {
  const last = cents(principal) - cents(emiAmount) * (emiMonths - 1);
  if (last <= 0 || last > cents(emiAmount)) return null;
  return Array.from({ length: emiMonths }, (_, i) => ({
    installmentNo: i + 1,
    dueDate: addMonths(disbursedOn, i + 1),
    amount: i === emiMonths - 1 ? last / 100 : emiAmount,
  }));
}

export interface LoanLimitResult {
  /** Principal allowed without an override. */
  maxPrincipal: number;
  overLimit: boolean;
  /** Monthly EMIs allowed in total. */
  maxTotalEmi: number;
  emiOverLimit: boolean;
}

/**
 * The organization's loan limits: principal up to `maxMultiple` × gross
 * monthly (above it only with an override), and all of the employee's EMIs
 * together (active and awaiting approval, plus this one) up to
 * `maxEmiPercent`% of gross monthly — never overridable, because pay would
 * not cover it.
 */
export function checkLoanLimits(input: {
  grossMonthly: number;
  principal: number;
  emiAmount: number;
  otherEmis: number;
  maxMultiple: number;
  maxEmiPercent: number;
}): LoanLimitResult {
  const maxPrincipal =
    Math.round(input.grossMonthly * input.maxMultiple * 100) / 100;
  const maxTotalEmi =
    Math.round(((input.grossMonthly * input.maxEmiPercent) / 100) * 100) / 100;
  return {
    maxPrincipal,
    overLimit: cents(input.principal) > cents(maxPrincipal),
    maxTotalEmi,
    emiOverLimit: cents(input.otherEmis + input.emiAmount) > cents(maxTotalEmi),
  };
}

/**
 * Applies a prepayment to the LAST pending installments first, so the
 * tenure shortens and the monthly EMI stays the same. Fully covered
 * installments become PREPAID; a partly covered one is reduced.
 */
export function applyPrepayment(
  pending: ReadonlyArray<{ id: number; installmentNo: number; amount: number }>,
  amount: number,
): {
  prepaidIds: number[];
  reduced: { id: number; amount: number } | null;
  applied: number;
} {
  let left = cents(amount);
  const prepaidIds: number[] = [];
  let reduced: { id: number; amount: number } | null = null;
  for (const inst of [...pending].sort(
    (a, b) => b.installmentNo - a.installmentNo,
  )) {
    if (left <= 0) break;
    const due = cents(inst.amount);
    if (left >= due) {
      prepaidIds.push(inst.id);
      left -= due;
    } else {
      reduced = { id: inst.id, amount: (due - left) / 100 };
      left = 0;
    }
  }
  return { prepaidIds, reduced, applied: (cents(amount) - left) / 100 };
}

/** The two approval steps of a loan request (Docs/PAYROLL_AND_COMPLIANCE.md
 * §3.7): HR review, then the final approval. */
export const LOAN_PENDING_STATUSES = ["PENDING_HR", "PENDING_ADMIN"] as const;

/**
 * Why a user may not act on a loan at its current step, or null when they
 * may. Maker-checker: the borrower never acts on their own loan, whoever
 * recorded it never reviews or approves it, and the final approver is never
 * the person who did the HR review.
 */
export function loanActionRefusal(
  step: "review" | "approve",
  loan: {
    status: string;
    createdBy: number | null;
    hrReviewedById: number | null;
    borrowerUserId: number | null;
  },
  userId: number,
): string | null {
  const expected = step === "review" ? "PENDING_HR" : "PENDING_ADMIN";
  if (loan.status !== expected) return "status";
  if (loan.borrowerUserId === userId) return "borrower";
  if (loan.createdBy === userId) return "requester";
  if (step === "approve" && loan.hrReviewedById === userId) return "reviewer";
  return null;
}
