import type { DayWorkflowStatus, ReviewStage } from "../types";

/** What a day's review state reads as, for the employee and for reviewers. */
export function reviewLabel(
  status: DayWorkflowStatus | null,
  stage: ReviewStage | null,
): string {
  switch (status) {
    case "SUBMITTED":
      return stage === "MANAGER"
        ? "Waiting for manager approval"
        : "Waiting for HR approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Returned";
    case "DRAFT":
      return "Draft";
    default:
      return "";
  }
}

// Literal class maps (never interpolated) so Tailwind keeps every class.
const CLASS: Record<DayWorkflowStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SUBMITTED: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  APPROVED:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  REJECTED:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

/** A small chip for the review state; nothing for a day with no rows. */
export function ReviewStatusChip({
  status,
  stage,
}: {
  status: DayWorkflowStatus | null;
  stage: ReviewStage | null;
}) {
  if (status === null) return null;
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${CLASS[status]}`}
      title="Where this day is in approval"
    >
      {reviewLabel(status, stage)}
    </span>
  );
}
