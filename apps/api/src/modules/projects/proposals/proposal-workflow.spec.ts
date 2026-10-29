import { describe, expect, it } from "vitest";
import {
  applyProposalTransition,
  assertTransitionComment,
  isFollowUpDue,
} from "./proposal-workflow.js";

describe("applyProposalTransition", () => {
  it("moves a draft into review", () => {
    expect(applyProposalTransition("draft", "submit_for_review")).toBe(
      "under_review",
    );
  });

  it("rejects an action not allowed from the current status", () => {
    expect(() => applyProposalTransition("draft", "send_to_client")).toThrow();
  });

  it("rejects an unknown action", () => {
    expect(() => applyProposalTransition("draft", "teleport")).toThrow();
  });
});

describe("assertTransitionComment", () => {
  it("requires a reason when rejecting or requesting changes", () => {
    expect(() =>
      assertTransitionComment("record_rejected", undefined),
    ).toThrow();
    expect(() => assertTransitionComment("request_changes", "   ")).toThrow();
    expect(() =>
      assertTransitionComment("record_rejected", "Budget exceeded"),
    ).not.toThrow();
  });

  it("does not require a comment for other actions", () => {
    expect(() =>
      assertTransitionComment("review_approve", undefined),
    ).not.toThrow();
  });
});

describe("isFollowUpDue", () => {
  const today = new Date("2026-10-24T09:00:00Z");

  it("is due when the date is today or earlier and the proposal is open", () => {
    expect(isFollowUpDue("sent", "2026-10-24", today)).toBe(true);
    expect(isFollowUpDue("draft", "2026-10-01", today)).toBe(true);
  });

  it("is not due for future dates, missing dates or closed proposals", () => {
    expect(isFollowUpDue("sent", "2026-10-25", today)).toBe(false);
    expect(isFollowUpDue("sent", null, today)).toBe(false);
    expect(isFollowUpDue("accepted", "2026-10-01", today)).toBe(false);
    expect(isFollowUpDue("archived", "2026-10-01", today)).toBe(false);
  });
});
