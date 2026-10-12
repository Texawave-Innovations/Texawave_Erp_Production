import { Alert } from "@texawave-erp/ui-kit";
import type { PayrollPeriod, PayrollRun } from "../types";

const STEPS = ["Period created", "Payroll run", "Approved", "Finalized"];

const NEXT: Record<number, string> = {
  1: "Next: run payroll to calculate pay for this period.",
  2: "Next: someone other than the person who ran payroll approves the run.",
  3: "Next: finalize the period to generate payslips and lock it.",
  4: "Done: payslips are generated and the period is locked.",
};

/** How far a period is through run → approve → finalize. */
export function lifecycleStep(
  period: PayrollPeriod,
  runs: readonly PayrollRun[],
): number {
  if (period.status === "FINALIZED") return 4;
  if (runs.some((r) => r.status === "APPROVED")) return 3;
  if (runs.some((r) => r.status === "PROCESSED")) return 2;
  return 1;
}

export function PayrollLifecycle({
  period,
  runs,
}: {
  period: PayrollPeriod;
  runs: readonly PayrollRun[];
}) {
  if (period.status === "CANCELLED") {
    return (
      <Alert variant="warning" title="Period cancelled">
        No payroll can be run for a cancelled period.
      </Alert>
    );
  }
  const done = lifecycleStep(period, runs);

  return (
    <div className="flex flex-col gap-2">
      <ol
        aria-label="Payroll progress"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {STEPS.map((label, i) => {
          const complete = i < done;
          return (
            <li
              key={label}
              aria-current={i === done - 1 ? "step" : undefined}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-theme-sm ${
                complete
                  ? "border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-950 dark:text-success-300"
                  : "border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400"
              }`}
            >
              <span aria-hidden="true">{complete ? "✓" : i + 1}</span>
              <span>{label}</span>
              <span className="sr-only">
                {complete ? "(complete)" : "(pending)"}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-theme-xs text-gray-600 dark:text-gray-400">
        {NEXT[done]}
      </p>
    </div>
  );
}
