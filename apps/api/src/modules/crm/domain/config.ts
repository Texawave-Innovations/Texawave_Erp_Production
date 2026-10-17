// CRM Core Domain — configuration constants (pipeline stages, lost/stuck reasons, etc.).
// Ships as code constants, matching how the rest of the CRM module already keeps its fixed
// vocabularies in code (see `intelligence/tabMeta.ts`). No admin screen edits these in this pass;
// they can be moved to a Firebase-backed settings screen later without touching callers, since
// every caller reads them only through this file.
import {
  CrmActivityType,
  CrmFollowUpStatus,
  CrmHoldReason,
  CrmLostReason,
  CrmMeetingStatus,
  CrmOpportunityHealth,
  CrmStuckReason,
} from "./types";

export interface PipelineStageDef {
  id: string;
  label: string;
  order: number;
  isWon?: boolean;
  isLost?: boolean;
  /** Firebase-backed stages only — whether the stage still appears on the board / stage pickers. */
  active?: boolean;
  /** Firebase-backed stages only — days in this stage before it's "Delayed" (Critical = 2x this). */
  slaDays?: number;
  /** Default win probability (%) for deals sitting in this stage — drives Expected/Weighted
   *  Revenue. A deal's own `probability` field can still override this per-deal. */
  probability?: number;
}

// Stage ids that `celebration/pipelineCelebration.ts` gives a dedicated celebration to — exported
// as named constants (rather than duplicated string literals) specifically so that link is
// compile-time-visible: both `PIPELINE_STAGES` below and `celebrationKeyForStage` reference these
// same constants, so renaming one can't silently desync the other the way two independent literal
// strings could.
export const STAGE_ID_INTERESTED = "interested";
export const STAGE_ID_PROPOSAL = "proposal";
export const STAGE_ID_NEGOTIATION = "negotiation";

/** Suggested pipeline stages from the CRM architecture brief, in order. */
export const PIPELINE_STAGES: PipelineStageDef[] = [
  { id: "new_lead", label: "New Lead", order: 1, probability: 5 },
  { id: "contacted", label: "Contacted", order: 2, probability: 10 },
  { id: STAGE_ID_INTERESTED, label: "Interested", order: 3, probability: 20 },
  {
    id: "meeting_scheduled",
    label: "Meeting Scheduled",
    order: 4,
    probability: 30,
  },
  {
    id: "meeting_completed",
    label: "Meeting Completed",
    order: 5,
    probability: 40,
  },
  {
    id: "requirement_discussion",
    label: "Requirement Discussion",
    order: 6,
    probability: 50,
  },
  { id: "demo", label: "Demo", order: 7, probability: 60 },
  { id: STAGE_ID_PROPOSAL, label: "Proposal", order: 8, probability: 70 },
  { id: "follow_up", label: "Follow-up", order: 9, probability: 75 },
  {
    id: STAGE_ID_NEGOTIATION,
    label: "Negotiation",
    order: 10,
    probability: 85,
  },
  { id: "won", label: "Won", order: 11, isWon: true, probability: 100 },
  { id: "lost", label: "Lost", order: 12, isLost: true, probability: 0 },
  { id: "on_hold", label: "On Hold", order: 13, probability: 0 },
];

/** Board columns only — Won/Lost/On Hold are reached via explicit status actions, not drag targets. */
export const PIPELINE_BOARD_STAGES = PIPELINE_STAGES.filter(
  (s) => !s.isWon && !s.isLost && s.id !== "on_hold",
);

export function stageLabel(stageId: string): string {
  return PIPELINE_STAGES.find((s) => s.id === stageId)?.label || stageId;
}

export const LOST_REASONS: CrmLostReason[] = [
  "Pricing",
  "Competitor Selected",
  "No Budget",
  "Requirement Not Supported",
  "Decision Delayed",
  "No Response",
  "Project Cancelled",
  "Internal Approval Failed",
  "Timeline Issue",
  "Product Gap",
  "Relationship Issue",
  "Other",
];

export const HOLD_REASONS: CrmHoldReason[] = [
  "Budget Freeze",
  "Client Requested Pause",
  "Internal Priority Change",
  "Awaiting Approval",
  "Awaiting Documentation",
  "Resourcing Constraint",
  "Other",
];

export const STUCK_REASONS: CrmStuckReason[] = [
  "Waiting for Client",
  "Client Unavailable",
  "Internal Approval Pending",
  "Pricing Discussion",
  "Technical Clarification",
  "No Response",
  "Competitor Evaluation",
  "Budget Issue",
  "Management Discussion",
  "Other",
];

/** Stage-age thresholds (in days) used to compute an opportunity's stuck/health status when a
 *  stage has no configured SLA of its own (fallback for legacy/unconfigured stages). */
export const STUCK_THRESHOLD_DAYS = { delayed: 7, critical: 14 };

/** `slaDaysOverride` comes from a stage's configured `slaDays` (see `pipelineStagesService.ts`) —
 *  when omitted, falls back to the global `STUCK_THRESHOLD_DAYS` so every existing call site that
 *  doesn't pass it keeps behaving exactly as before. */
export function computeOpportunityHealth(
  stageEnteredAt: number,
  status: string,
  slaDaysOverride?: number,
): CrmOpportunityHealth {
  if (status !== "OPEN") return "Healthy";
  const ageDays = (Date.now() - stageEnteredAt) / 86400000;
  const delayed = slaDaysOverride ?? STUCK_THRESHOLD_DAYS.delayed;
  const critical = slaDaysOverride
    ? slaDaysOverride * 2
    : STUCK_THRESHOLD_DAYS.critical;
  if (ageDays >= critical) return "Critical";
  if (ageDays >= delayed) return "Delayed";
  return "Healthy";
}

/** Whole days elapsed since a timestamp — the shared calc behind every "days in stage" /
 *  "days since last touch" badge, so Pipeline cards and Deal/Account detail pages all agree. */
export function daysSince(timestamp: number | undefined): number | null {
  if (!timestamp) return null;
  return Math.floor((Date.now() - timestamp) / 86400000);
}

/** Expected/weighted revenue for a deal — `estimatedValue` weighted by its win probability
 *  (either the deal's own override or the stage default passed in by the caller). Returns 0 for
 *  a missing/zero probability rather than the full value, per the "weighted pipeline" convention
 *  used across the CRM brief (never assume 100% just because a deal has no probability set). */
export function computeExpectedRevenue(
  estimatedValue: number,
  probability: number | undefined,
): number {
  return Math.round((estimatedValue || 0) * ((probability ?? 0) / 100));
}

/** Deterministic, muted color set for pipeline stage columns — cycles by a stage's `order` so the
 *  same stage always renders the same color regardless of render order or filtering, without
 *  needing a color field on the stage record itself. Purely a display concern (Pipeline board). */
export const STAGE_COLOR_PALETTE = [
  {
    topBorder: "border-t-blue-400",
    headerBg: "bg-blue-50/70",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    text: "text-blue-800",
  },
  {
    topBorder: "border-t-violet-400",
    headerBg: "bg-violet-50/70",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    text: "text-violet-800",
  },
  {
    topBorder: "border-t-amber-400",
    headerBg: "bg-amber-50/70",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    text: "text-amber-800",
  },
  {
    topBorder: "border-t-cyan-400",
    headerBg: "bg-cyan-50/70",
    badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
    text: "text-cyan-800",
  },
  {
    topBorder: "border-t-orange-400",
    headerBg: "bg-orange-50/70",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    text: "text-orange-800",
  },
  {
    topBorder: "border-t-teal-400",
    headerBg: "bg-teal-50/70",
    badge: "bg-teal-100 text-teal-700 border-teal-200",
    text: "text-teal-800",
  },
  {
    topBorder: "border-t-pink-400",
    headerBg: "bg-pink-50/70",
    badge: "bg-pink-100 text-pink-700 border-pink-200",
    text: "text-pink-800",
  },
  {
    topBorder: "border-t-indigo-400",
    headerBg: "bg-indigo-50/70",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    text: "text-indigo-800",
  },
] as const;

export function stageColorFor(
  order: number | undefined,
): (typeof STAGE_COLOR_PALETTE)[number] {
  const n = Number.isFinite(order) ? Math.floor(order as number) : 0;
  const idx =
    (((n - 1) % STAGE_COLOR_PALETTE.length) + STAGE_COLOR_PALETTE.length) %
    STAGE_COLOR_PALETTE.length;
  return STAGE_COLOR_PALETTE[idx];
}

/** Follow-up's effective status for DISPLAY only — never written back to the record. A PENDING
 *  follow-up whose scheduled date/time has passed shows as OVERDUE everywhere in the UI without
 *  mutating stored data (avoids write races between multiple viewers/tabs). */
export function getEffectiveFollowUpStatus(followUp: {
  status: CrmFollowUpStatus;
  scheduledAt: string;
}): CrmFollowUpStatus {
  if (followUp.status !== "PENDING") return followUp.status;
  const due = new Date(followUp.scheduledAt);
  if (Number.isNaN(due.getTime())) return followUp.status;
  return due.getTime() < Date.now() ? "OVERDUE" : "PENDING";
}

export const ACTIVITY_TYPES: CrmActivityType[] = [
  "Call",
  "Email",
  "WhatsApp",
  "Meeting",
  "Demo",
  "Note",
  "Task",
  "Follow-up",
  "Proposal",
  "LinkedIn",
];

export const FOLLOW_UP_STATUSES: CrmFollowUpStatus[] = [
  "PENDING",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED",
  "RESCHEDULED",
  "MISSED",
];

export const MEETING_STATUSES: CrmMeetingStatus[] = [
  "REQUESTED",
  "TENTATIVE",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_SHOW",
];

// --- Firebase path constants — all new, isolated collections under `crm/` ------------------------
export const CRM_ACCOUNTS_PATH = "crm/accounts";
export const CRM_CONTACTS_PATH = "crm/contacts";
export const CRM_OPPORTUNITIES_PATH = "crm/opportunities";
export const CRM_STAGE_HISTORY_PATH = "crm/opportunityStageHistory";
export const CRM_ACTIVITIES_PATH = "crm/activities";
export const CRM_FOLLOWUPS_PATH = "crm/followups";
export const CRM_MEETINGS_PATH = "crm/meetings";
export const CRM_TASKS_PATH = "crm/tasks";
export const CRM_QUOTATIONS_PATH = "crm/quotations";
export const CRM_DOCUMENTS_PATH = "crm/documents";
export const CRM_PIPELINE_STAGES_PATH = "crm/pipelineStages";
export const CRM_PRODUCTS_PATH = "crm/products";
export const CRM_DEAL_PRODUCTS_PATH = "crm/dealProducts";
export const CRM_QUOTATION_ITEMS_PATH = "crm/quotationItems";
export const CRM_COMPETITORS_PATH = "crm/competitors";
export const CRM_QUOTAS_PATH = "crm/quotas";
export const CRM_SAVED_VIEWS_PATH = "crm/savedViews";
export const CRM_QUOTATION_VERSIONS_PATH = "crm/quotationVersions";
