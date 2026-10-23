"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Undo2 } from "lucide-react";
import { Alert, Button, Semantic3DIcon, cn } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { ONBOARDING_APPROVE_TEAM_OR_ALL } from "../permissions";
import type { EmployeeDetail } from "../types";
import {
  OnboardingReviewBadge,
  REVIEW_LABELS,
} from "./OnboardingReviewBadge";
import {
  ReviewOnboardingDialog,
  type ReviewDecision,
} from "./ReviewOnboardingDialog";

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    : null;

/**
 * HR's review of the profile the employee submitted. Shown on the employee
 * record and on the onboarding page. Actions appear only while the profile
 * is waiting for review, to holders of the approve permission, and never on
 * the reviewer's own record — the API enforces all three.
 */
export function OnboardingReviewPanel({
  employee,
}: {
  employee: Pick<
    EmployeeDetail,
    | "id"
    | "fullName"
    | "userId"
    | "onboardingReviewStatus"
    | "onboardingSubmittedAt"
    | "onboardingReviewedAt"
    | "onboardingReviewNote"
  >;
}) {
  const canApprove = usePermission(ONBOARDING_APPROVE_TEAM_OR_ALL);
  const myUserId = useAuthStore((s) => s.user?.userId ?? null);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);

  const status = employee.onboardingReviewStatus;
  if (status === "NOT_SUBMITTED") return null;

  const isSelf = myUserId !== null && employee.userId === myUserId;
  const canAct = canApprove && status === "PENDING_REVIEW" && !isSelf;
  const submitted = when(employee.onboardingSubmittedAt);
  const reviewed = when(employee.onboardingReviewedAt);

  const variant =
    status === "PENDING_REVIEW"
      ? "info"
      : status === "APPROVED"
        ? "success"
        : "warning";
  const title =
    status === "PENDING_REVIEW"
      ? "Onboarding details submitted for review"
      : status === "APPROVED"
        ? "Onboarding approved"
        : "Sent back to the employee";

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-5 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-800 dark:from-slate-850 dark:via-slate-900 dark:to-slate-900/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
              <Semantic3DIcon name="check" size={28} />
            </div>
            <div className="flex flex-col gap-1 text-theme-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#0a3271] dark:text-sky-100">{title}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-xs",
                    status === "APPROVED"
                      ? "border-emerald-200/90 bg-emerald-50/90 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : status === "CHANGES_REQUESTED"
                        ? "border-rose-200/90 bg-rose-50/90 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300"
                        : "border-sky-200/90 bg-sky-50/90 text-brand-500 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      status === "APPROVED"
                        ? "bg-emerald-500"
                        : status === "CHANGES_REQUESTED"
                          ? "bg-rose-500"
                          : "bg-500 animate-pulse",
                    )}
                  />
                  {REVIEW_LABELS[status]}
                </span>
                {submitted ? <span className="text-xs text-[#2f6396] dark:text-sky-300/80">Submitted {submitted}</span> : null}
                {reviewed && status !== "PENDING_REVIEW" ? (
                  <span className="text-xs text-[#2f6396] dark:text-sky-300/80">· Reviewed {reviewed}</span>
                ) : null}
              </div>
              {status === "PENDING_REVIEW" ? (
                <p className="text-xs text-[#2f6396] dark:text-sky-300/80">
                  Check the profile and documents, then approve them or send them back with what to correct.
                </p>
              ) : null}
              {status === "APPROVED" && !reviewed ? (
                <p className="text-xs text-[#2f6396] dark:text-sky-300/80">Completed before the review step existed.</p>
              ) : null}
              {employee.onboardingReviewNote ? (
                <p className="text-xs text-[#2f6396] dark:text-sky-300/80">
                  <span className="font-semibold">{status === "CHANGES_REQUESTED" ? "Requested: " : "Note: "}</span>
                  {employee.onboardingReviewNote}
                </p>
              ) : null}
              {canApprove && status === "PENDING_REVIEW" && isSelf ? (
                <p className="text-xs text-[#2f6396] dark:text-sky-300/80">This is your own profile — another reviewer must decide.</p>
              ) : null}
            </div>
          </div>
          {canAct ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDecision("send_back")}>
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                Send back
              </Button>
              <Button size="sm" onClick={() => setDecision("approve")}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Approve
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {decision ? (
        <ReviewOnboardingDialog
          open
          onClose={() => setDecision(null)}
          employee={employee}
          decision={decision}
        />
      ) : null}
    </>
  );
}
