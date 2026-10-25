import type { ProposalWorkflowAction } from "@texawave-erp/api-types";

/** Mirrors `apps/api/src/modules/projects/proposals/proposal-workflow.ts` —
 * which actions are available from the current status, purely for deciding
 * which buttons to show (the API re-validates and is authoritative). */
export const PROPOSAL_ACTIONS_BY_STATUS: Record<
  string,
  { action: ProposalWorkflowAction; label: string }[]
> = {
  draft: [{ action: "submit_for_review", label: "Submit for Review" }],
  under_review: [
    { action: "review_approve", label: "Approve" },
    { action: "request_changes", label: "Request Changes" },
    { action: "revert_to_draft", label: "Revert to Draft" },
  ],
  changes_requested: [
    { action: "submit_for_review", label: "Resubmit for Review" },
    { action: "revert_to_draft", label: "Revert to Draft" },
  ],
  approved: [
    { action: "send_to_client", label: "Send to Client" },
    { action: "revert_to_draft", label: "Revert to Draft" },
  ],
  sent: [
    { action: "record_accepted", label: "Record Accepted" },
    { action: "record_rejected", label: "Record Rejected" },
  ],
  accepted: [],
  rejected: [],
  archived: [],
};
