"use client";

import { StatusBadge, type StatusColorToken } from "@texawave-erp/ui-kit";
import type { OnboardingReviewStatus } from "../types";

/** HR's review of a submitted onboarding profile (onboarding-review.policy.ts
 * on the API). Separate from OnboardingStatusBadge, which only says whether
 * the employee finished the wizard. */
export const REVIEW_LABELS: Record<OnboardingReviewStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING_REVIEW: "Review submitted details",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
};

const TOKENS: Record<OnboardingReviewStatus, StatusColorToken> = {
  NOT_SUBMITTED: "gray",
  PENDING_REVIEW: "brand",
  APPROVED: "success",
  CHANGES_REQUESTED: "warning",
};

/** A profile waiting for HR pulses (legacy's "Review Submitted Details"
 * cue) unless the user prefers reduced motion. */
export function OnboardingReviewBadge({
  status,
}: {
  status: OnboardingReviewStatus;
}) {
  return (
    <StatusBadge
      label={REVIEW_LABELS[status]}
      colorToken={TOKENS[status]}
      {...(status === "PENDING_REVIEW"
        ? { className: "motion-safe:animate-pulse" }
        : {})}
    />
  );
}
