import type {
  ProposalSectionConfig,
  ProposalStatus,
  ProposalWorkflowAction,
} from "@texawave-erp/api-types";
import { todayInput, toDateInput } from "@/features/projects/format";
import { getFieldValidationError } from "./field-validation";

export type ProposalTone = "brand" | "gray" | "success" | "warning" | "error";

/** Legacy `ProposalsHub.tsx` `STATUS_CONFIG` labels. */
export const PROPOSAL_STATUS_META: Record<
  ProposalStatus,
  { label: string; tone: ProposalTone }
> = {
  draft: { label: "Draft", tone: "gray" },
  under_review: { label: "Under Review", tone: "warning" },
  changes_requested: { label: "Changes Requested", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  sent: { label: "Sent to Client", tone: "brand" },
  accepted: { label: "Accepted", tone: "success" },
  rejected: { label: "Rejected", tone: "error" },
  archived: { label: "Archived", tone: "gray" },
};

export const PROPOSAL_STATUSES = Object.keys(
  PROPOSAL_STATUS_META,
) as ProposalStatus[];

/** Mirrors the API's `PROPOSAL_EDITABLE_STATUSES` (proposal-workflow.ts). */
export const EDITABLE_STATUSES: ProposalStatus[] = [
  "draft",
  "changes_requested",
];

/** Mirrors the API's `FOLLOW_UP_CLOSED_STATUSES`. */
const FOLLOW_UP_CLOSED: ProposalStatus[] = [
  "approved",
  "accepted",
  "rejected",
  "archived",
];

export type FollowUpState =
  "none" | "closed" | "overdue" | "today" | "upcoming";

export function followUpState(
  status: ProposalStatus,
  dueDate: string | null,
): FollowUpState {
  if (!dueDate) return "none";
  if (FOLLOW_UP_CLOSED.includes(status)) return "closed";
  const due = toDateInput(dueDate);
  const today = todayInput();
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

/** Workflow actions offered per action, with whether a comment is required
 * (mirrors the API's `COMMENT_REQUIRED_ACTIONS`). */
export const WORKFLOW_ACTION_META: Record<
  ProposalWorkflowAction,
  {
    label: string;
    title: string;
    description: string;
    requireComment: boolean;
    destructive?: boolean;
  }
> = {
  submit_for_review: {
    label: "Submit for Review",
    title: "Submit for internal review",
    description:
      "The proposal is locked for editing while a reviewer checks it.",
    requireComment: false,
  },
  review_approve: {
    label: "Approve",
    title: "Approve proposal",
    description: "Marks the proposal ready to be sent to the client.",
    requireComment: false,
  },
  request_changes: {
    label: "Request Changes",
    title: "Request changes",
    description:
      "Sends the proposal back to its author. Explain what needs to change.",
    requireComment: true,
    destructive: true,
  },
  send_to_client: {
    label: "Send to Client",
    title: "Send to client",
    description:
      "Records that the approved proposal was delivered to the client.",
    requireComment: false,
  },
  record_accepted: {
    label: "Mark Accepted",
    title: "Client accepted proposal",
    description:
      "Record client acceptance — note any agreed variations, PO number or remarks.",
    requireComment: false,
  },
  record_rejected: {
    label: "Mark Rejected",
    title: "Client rejected proposal",
    description:
      "Record why the client did not accept (budget, scope, competitor...).",
    requireComment: true,
    destructive: true,
  },
  revert_to_draft: {
    label: "Revert to Draft",
    title: "Revert to draft",
    description: "Unlocks the proposal for editing again.",
    requireComment: false,
  },
  archive: {
    label: "Archive",
    title: "Archive proposal",
    description:
      "Archived proposals are kept for reference but leave the active pipeline.",
    requireComment: false,
    destructive: true,
  },
};

/** Actions available from each status (mirrors `PROPOSAL_TRANSITIONS`). */
export const ACTIONS_BY_STATUS: Record<
  ProposalStatus,
  ProposalWorkflowAction[]
> = {
  draft: ["submit_for_review", "archive"],
  under_review: [
    "review_approve",
    "request_changes",
    "revert_to_draft",
    "archive",
  ],
  changes_requested: ["submit_for_review", "revert_to_draft", "archive"],
  approved: ["send_to_client", "revert_to_draft", "archive"],
  sent: ["record_accepted", "record_rejected", "archive"],
  accepted: ["archive"],
  rejected: ["archive"],
  archived: [],
};

/** Flattens nested `section_group` children so every fillable section is
 * visited (values are keyed by section id regardless of nesting). */
export function flattenSections(
  sections: ProposalSectionConfig[],
): ProposalSectionConfig[] {
  const out: ProposalSectionConfig[] = [];
  for (const s of [...sections].sort((a, b) => a.order - b.order)) {
    out.push(s);
    if (s.type === "section_group" && s.children)
      out.push(...flattenSections(s.children));
  }
  return out;
}

function hasContent(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) {
    return value.some((v) =>
      typeof v === "string"
        ? v.trim().length > 0
        : v &&
          typeof v === "object" &&
          Object.values(v).some((x) => String(x ?? "").trim()),
    );
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((x) => String(x ?? "").trim().length > 0);
  }
  return false;
}

/** Legacy `ProposalEditor` completion meter + validation issues: header
 * fields plus every content section; required sections with no content are
 * reported as issues. Layout-only sections are not counted. */
export function proposalCompleteness(
  header: { title: string; clientName: string; proposalDate: string },
  sections: ProposalSectionConfig[],
  values: Record<string, unknown>,
): { percent: number; issues: string[] } {
  const issues: string[] = [];
  let total = 3;
  let done = 0;
  if (header.title.trim()) done++;
  else issues.push("Proposal title is empty");
  if (header.clientName.trim()) done++;
  else issues.push("Client name is empty");
  if (header.proposalDate) done++;
  else issues.push("Proposal date is missing");

  for (const s of flattenSections(sections)) {
    if (
      s.type === "page_break" ||
      s.type === "spacer" ||
      s.type === "section_group"
    )
      continue;
    total++;
    const filled = hasContent(values[s.id]);
    if (filled) {
      done++;
      if (s.type === "key_value" && s.keyValueFields) {
        const kv = (
          values[s.id] && typeof values[s.id] === "object" ? values[s.id] : {}
        ) as Record<string, string>;
        for (const f of s.keyValueFields) {
          const val = String(
            kv[f.id] ?? f.defaultValue ?? f.value ?? "",
          ).trim();
          if (val) {
            const err = getFieldValidationError(f.type ?? "text", val);
            if (err) {
              issues.push(`"${s.title}" → ${f.label}: ${err}`);
            }
          }
        }
      }
    } else if (s.required)
      issues.push(`Required section "${s.title}" is missing content`);
  }
  return {
    percent: total > 0 ? Math.round((done / total) * 100) : 100,
    issues,
  };
}
