"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Undo2 } from "lucide-react";
import { Alert, Button } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { ONBOARDING_APPROVE_TEAM_OR_ALL } from "../permissions";
import type { EmployeeDetail } from "../types";
import { OnboardingReviewBadge } from "./OnboardingReviewBadge";
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
      <Alert variant={variant} title={title}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1 text-theme-xs">
            <div className="flex flex-wrap items-center gap-2">
              <OnboardingReviewBadge status={status} />
              {submitted ? <span>Submitted {submitted}</span> : null}
              {reviewed && status !== "PENDING_REVIEW" ? (
                <span>· Reviewed {reviewed}</span>
              ) : null}
            </div>
            {status === "PENDING_REVIEW" ? (
              <p>
                Check the profile and documents, then approve them or send them
                back with what to correct.
              </p>
            ) : null}
            {status === "APPROVED" && !reviewed ? (
              <p>Completed before the review step existed.</p>
            ) : null}
            {employee.onboardingReviewNote ? (
              <p>
                <span className="font-semibold">
                  {status === "CHANGES_REQUESTED" ? "Requested: " : "Note: "}
                </span>
                {employee.onboardingReviewNote}
              </p>
            ) : null}
            {canApprove && status === "PENDING_REVIEW" && isSelf ? (
              <p>This is your own profile — another reviewer must decide.</p>
            ) : null}
          </div>
          {canAct ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDecision("send_back")}
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                Send back
              </Button>
              <Button size="sm" onClick={() => setDecision("approve")}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Approve
              </Button>
            </div>
          ) : status === "APPROVED" ? (
            <ClipboardCheck
              aria-hidden
              className="hidden h-5 w-5 shrink-0 sm:block"
            />
          ) : null}
        </div>
      </Alert>
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
