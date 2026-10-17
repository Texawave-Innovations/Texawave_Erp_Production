// HANDWRITTEN — mirrors apps/api/src/modules/crm/shared/related-entity.ts.
// Shared polymorphic relation used by Meeting/FollowUp/Activity/Task/
// Document. See packages/api-types/README.md.

export const RELATED_TYPES = [
  "account",
  "contact",
  "opportunity",
  "lead",
] as const;
export type RelatedType = (typeof RELATED_TYPES)[number];

// HANDWRITTEN — mirrors apps/api/src/modules/crm/shared/activity-types.ts.
export const ACTIVITY_TYPES = [
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
  "Stage Change",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_DIRECTIONS = ["Sent", "Received"] as const;
export type ActivityDirection = (typeof ACTIVITY_DIRECTIONS)[number];
