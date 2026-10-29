import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";

/** Legacy `ProposalsHub.tsx` workflow state machine — one `ProposalActivity`
 * row is written per transition (handled by the repository), so this stays
 * pure: given the current status and an action, return the next status or
 * throw. */
export const PROPOSAL_TRANSITIONS: Record<
  string,
  { from: string[]; to: string }
> = {
  submit_for_review: {
    from: ["draft", "changes_requested"],
    to: "under_review",
  },
  review_approve: { from: ["under_review"], to: "approved" },
  request_changes: { from: ["under_review"], to: "changes_requested" },
  send_to_client: { from: ["approved"], to: "sent" },
  record_accepted: { from: ["sent"], to: "accepted" },
  record_rejected: { from: ["sent"], to: "rejected" },
  revert_to_draft: {
    from: ["under_review", "changes_requested", "approved"],
    to: "draft",
  },
  archive: {
    from: [
      "draft",
      "under_review",
      "changes_requested",
      "approved",
      "sent",
      "accepted",
      "rejected",
    ],
    to: "archived",
  },
};

export function applyProposalTransition(
  currentStatus: string,
  action: string,
): string {
  const transition = PROPOSAL_TRANSITIONS[action];
  if (!transition) {
    throw new InvalidStateTransitionException(
      "Proposal",
      currentStatus,
      action,
      `unknown action "${action}"`,
    );
  }
  if (!transition.from.includes(currentStatus)) {
    throw new InvalidStateTransitionException(
      "Proposal",
      currentStatus,
      transition.to,
      `action "${action}" is not allowed from "${currentStatus}"`,
    );
  }
  return transition.to;
}

/** Legacy hub/editor required a written reason for these moves (the
 * "Reason why Rejected" / change-request comment boxes were mandatory). */
export const COMMENT_REQUIRED_ACTIONS = ["request_changes", "record_rejected"];

export function assertTransitionComment(
  action: string,
  comments: string | undefined,
): void {
  if (COMMENT_REQUIRED_ACTIONS.includes(action) && !comments?.trim()) {
    throw new BusinessRuleViolationException(
      `A comment explaining the reason is required for "${action}"`,
      "PROPOSAL_COMMENT_REQUIRED",
    );
  }
}

/** Content (title, sections, template) can only change while the proposal
 * is with its author — once under review, approved or sent it is the
 * version of record. */
export const PROPOSAL_EDITABLE_STATUSES = ["draft", "changes_requested"];

/** Statuses for which a follow-up date no longer needs chasing (legacy
 * hub excluded these from "Follow-ups Due"). */
export const FOLLOW_UP_CLOSED_STATUSES = [
  "approved",
  "accepted",
  "rejected",
  "archived",
];

export function isFollowUpDue(
  status: string,
  dueDate: Date | string | null,
  today: Date = new Date(),
): boolean {
  if (!dueDate || FOLLOW_UP_CLOSED_STATUSES.includes(status)) return false;
  const due = new Date(dueDate).toISOString().slice(0, 10);
  return due <= today.toISOString().slice(0, 10);
}
