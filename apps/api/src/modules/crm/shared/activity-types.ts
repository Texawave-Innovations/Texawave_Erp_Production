/** Mirrors legacy `CrmActivityType` (domain/types.ts) exactly. Shared
 * between CrmActivity and CrmFollowUp — legacy's `CrmFollowUp.type` field
 * reuses this same vocabulary (confirmed: `followupsService.ts`'s type
 * imports `CrmActivityType`, not a separate enum). `'Stage Change'` is a
 * legal value but is only ever auto-logged by the Opportunity stage-change
 * flow, never user-selectable — legacy's own `ACTIVITY_TYPES` UI picker
 * constant excludes it for the same reason; kept here for completeness
 * since the DB column must still accept it. */
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
