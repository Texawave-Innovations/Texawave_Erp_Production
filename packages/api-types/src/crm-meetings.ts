// HANDWRITTEN — mirrors apps/api/src/modules/crm/meetings/dto/meeting.dto.ts
// and apps/api/src/modules/crm/meetings/meetings.{controller,service}.ts.
// See packages/api-types/README.md.

import type { RelatedType } from "./crm-related-entity.js";

export const MEETING_MODES = ["Online", "Onsite", "Phone", "Demo"] as const;
export type MeetingMode = (typeof MEETING_MODES)[number];

/** Mirrors legacy `CrmMeetingStatus` exactly. */
export const MEETING_STATUSES = [
  "REQUESTED",
  "TENTATIVE",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_SHOW",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export interface MeetingReschedule {
  id: number;
  meetingId: number;
  previousDate: string;
  reason: string | null;
  rescheduledBy: number | null;
  rescheduledAt: string;
}

export interface Meeting {
  /** Resolved server-side from users.full_name (list responses). */
  createdByName?: string | null | undefined;
  updatedByName?: string | null | undefined;
  id: number;
  organizationId: number;
  relatedType: RelatedType;
  relatedId: number;
  mode: MeetingMode;
  meetingDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  meetingLink: string | null;
  agenda: string | null;
  participants: string | null;
  status: MeetingStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  summary: string | null;
  requirements: string | null;
  concerns: string | null;
  competitors: string | null;
  budget: string | null;
  decisionMaker: string | null;
  expectedTimeline: string | null;
  nextStep: string | null;
  nextFollowUpAt: string | null;
  reschedules: MeetingReschedule[];
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateMeetingInput {
  relatedType: RelatedType;
  relatedId: number;
  mode?: MeetingMode | undefined;
  meetingDate: string;
  startTime?: string | undefined;
  endTime?: string | undefined;
  location?: string | undefined;
  meetingLink?: string | undefined;
  agenda?: string | undefined;
  participants?: string | undefined;
}

export type UpdateMeetingInput = Partial<
  Omit<CreateMeetingInput, "relatedType" | "relatedId">
>;

export interface UpdateMeetingStatusInput {
  status: MeetingStatus;
}

/** Mirrors legacy `completeCrmMeeting`'s outcome-capture fields exactly. */
export interface CompleteMeetingInput {
  summary?: string | undefined;
  requirements?: string | undefined;
  concerns?: string | undefined;
  competitors?: string | undefined;
  budget?: string | undefined;
  decisionMaker?: string | undefined;
  expectedTimeline?: string | undefined;
  nextStep?: string | undefined;
  nextFollowUpAt?: string | undefined;
}

export interface RescheduleMeetingInput {
  newDate: string;
  reason?: string | undefined;
}

export interface QueryMeetingsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  relatedType?: RelatedType | undefined;
  relatedId?: number | undefined;
  /** Account roll-up: the account's own records plus those of its contacts and opportunities. */
  rollupAccountId?: number | undefined;
  status?: MeetingStatus | undefined;
}
