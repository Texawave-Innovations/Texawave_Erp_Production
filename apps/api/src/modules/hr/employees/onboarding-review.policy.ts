import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

/**
 * HR's review of a submitted onboarding profile (Docs/ARCHITECTURE.md §7).
 * Independent of `onboarding_status`, which only says whether the employee
 * has finished the wizard and so opens the portal:
 *
 *   NOT_SUBMITTED ──submit──► PENDING_REVIEW ──approve──► APPROVED
 *                                   │
 *                                   └──send back──► CHANGES_REQUESTED ──resubmit──► PENDING_REVIEW
 *
 * Sending back also reopens the wizard (onboarding_status → PENDING_ACTIVATION)
 * so the employee can correct their details and submit again.
 */
export const ONBOARDING_REVIEW_STATUSES = [
  "NOT_SUBMITTED",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
] as const;
export type OnboardingReviewStatus =
  (typeof ONBOARDING_REVIEW_STATUSES)[number];

export type ReviewDecision = "approve" | "send_back";

/** Only a profile waiting for review can be decided on. */
export function assertReviewable(current: string): void {
  if (current !== "PENDING_REVIEW") {
    throw new BusinessRuleViolationException(
      `Only a submitted profile waiting for review can be decided on (current review status: ${current})`,
      "ONBOARDING_NOT_PENDING_REVIEW",
    );
  }
}

export function reviewOutcome(decision: ReviewDecision): {
  reviewStatus: OnboardingReviewStatus;
  onboardingStatus?: "PENDING_ACTIVATION";
} {
  return decision === "approve"
    ? { reviewStatus: "APPROVED" }
    : {
        reviewStatus: "CHANGES_REQUESTED",
        onboardingStatus: "PENDING_ACTIVATION",
      };
}
