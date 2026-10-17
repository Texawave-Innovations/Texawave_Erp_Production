// HANDWRITTEN — mirrors
// apps/api/src/modules/crm/follow-ups/dto/follow-up.dto.ts and
// apps/api/src/modules/crm/follow-ups/follow-ups.{controller,service}.ts.
// See packages/api-types/README.md.

import type { ActivityType, RelatedType } from "./crm-related-entity.js";

/** Mirrors legacy `CrmFollowUpStatus` exactly. `OVERDUE` is NEVER persisted
 * — it is a computed-only `effectiveStatus` derived at read time (see
 * `Meeting`-adjacent service `withEffectiveStatus`). Only these 5 values
 * are ever written to the `status` column. */
export const FOLLOW_UP_STATUSES = [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "MISSED",
] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

/** Display-only status, never persisted — includes the derived `OVERDUE`
 * state on top of the 5 persisted `FollowUpStatus` values. */
export type FollowUpEffectiveStatus = FollowUpStatus | "OVERDUE";

export const FOLLOW_UP_PRIORITIES = ["High", "Medium", "Low"] as const;
export type FollowUpPriority = (typeof FOLLOW_UP_PRIORITIES)[number];

export interface FollowUpReschedule {
  id: number;
  followUpId: number;
  previousDate: string;
  reason: string | null;
  rescheduledBy: number | null;
  rescheduledAt: string;
}

export interface FollowUp {
  /** Resolved server-side from users.full_name (list responses). */
  createdByName?: string | null | undefined;
  updatedByName?: string | null | undefined;
  id: number;
  organizationId: number;
  relatedType: RelatedType;
  relatedId: number;
  type: ActivityType;
  scheduledAt: string;
  assignedTo: string;
  priority: FollowUpPriority;
  notes: string | null;
  outcome: string | null;
  /** Stored status — never `OVERDUE`. Use `effectiveStatus` for display. */
  status: FollowUpStatus;
  /** Computed at read time: PENDING + scheduledAt passed -> OVERDUE.
   * UI must show/filter by this, not `status`, for the overdue badge. */
  effectiveStatus: FollowUpEffectiveStatus;
  nextFollowUpAt: string | null;
  reschedules: FollowUpReschedule[];
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateFollowUpInput {
  relatedType: RelatedType;
  relatedId: number;
  type: ActivityType;
  scheduledAt: string;
  assignedTo: string;
  priority?: FollowUpPriority | undefined;
  notes?: string | undefined;
}

export type UpdateFollowUpInput = Partial<
  Omit<CreateFollowUpInput, "relatedType" | "relatedId">
>;

export interface UpdateFollowUpStatusInput {
  status: FollowUpStatus;
  outcome?: string | undefined;
  nextFollowUpAt?: string | undefined;
}

export interface RescheduleFollowUpInput {
  newScheduledAt: string;
  reason?: string | undefined;
}

export interface QueryFollowUpsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  relatedType?: RelatedType | undefined;
  relatedId?: number | undefined;
  /** Account roll-up: the account's own records plus those of its contacts and opportunities. */
  rollupAccountId?: number | undefined;
  status?: FollowUpStatus | undefined;
}
