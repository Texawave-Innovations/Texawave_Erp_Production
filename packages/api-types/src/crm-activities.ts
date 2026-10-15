// HANDWRITTEN — mirrors
// apps/api/src/modules/crm/activities/dto/activity.dto.ts and
// apps/api/src/modules/crm/activities/activities.controller.ts. See
// packages/api-types/README.md.

import type {
  ActivityDirection,
  ActivityType,
  RelatedType,
} from "./crm-related-entity.js";

export interface CrmActivity {
  id: number;
  organizationId: number;
  relatedType: RelatedType;
  relatedId: number;
  type: ActivityType;
  subject: string;
  notes: string | null;
  direction: ActivityDirection | null;
  occurredAt: string;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
}

export interface CreateCrmActivityInput {
  relatedType: RelatedType;
  relatedId: number;
  type: ActivityType;
  subject: string;
  notes?: string | undefined;
  direction?: ActivityDirection | undefined;
  /** Defaults server-side to now when omitted. */
  occurredAt?: string | undefined;
}

export type UpdateCrmActivityInput = Partial<CreateCrmActivityInput>;

export interface QueryCrmActivitiesInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  relatedType?: RelatedType | undefined;
  relatedId?: number | undefined;
  type?: ActivityType | undefined;
}
