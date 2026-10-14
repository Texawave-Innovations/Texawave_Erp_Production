import { describe, expect, it } from "vitest";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { assertReviewable, reviewOutcome } from "./onboarding-review.policy.js";

describe("onboarding review policy", () => {
  it("only a profile waiting for review can be decided on", () => {
    expect(() => assertReviewable("PENDING_REVIEW")).not.toThrow();
    for (const status of ["NOT_SUBMITTED", "APPROVED", "CHANGES_REQUESTED"]) {
      expect(() => assertReviewable(status)).toThrow(
        BusinessRuleViolationException,
      );
    }
  });

  it("approving leaves the portal open; sending back reopens the wizard", () => {
    expect(reviewOutcome("approve")).toEqual({ reviewStatus: "APPROVED" });
    expect(reviewOutcome("send_back")).toEqual({
      reviewStatus: "CHANGES_REQUESTED",
      onboardingStatus: "PENDING_ACTIVATION",
    });
  });
});
