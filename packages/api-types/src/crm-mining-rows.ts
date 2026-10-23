// HANDWRITTEN — mirrors
// apps/api/src/modules/crm/mining-rows/dto/mining-row.dto.ts and
// apps/api/src/modules/crm/mining-rows/mining-rows.controller.ts. See
// packages/api-types/README.md.

export const MINING_PRIORITIES = ["High", "Medium", "Low"] as const;
export type MiningPriority = (typeof MINING_PRIORITIES)[number];

/** Legacy `AccountsMiningRow` (AccountsMiningSheet.tsx). All columns are
 * free text; legacy `date` is `minedDate`. */
export interface CrmMiningRow {
  id: number;
  organizationId: number;
  serialNo: string | null;
  minedDate: string | null;
  domain: string | null;
  companyName: string;
  hq: string | null;
  website: string | null;
  keyDecisionMakers: string | null;
  title: string | null;
  contactNumber: string | null;
  email: string | null;
  emailStatus: string | null;
  followUpStatus: string | null;
  industry: string | null;
  numberOfEmployees: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedInProfile: string | null;
  assignedTo: string | null;
  priority: string | null;
  nextFollowUpDate: string | null;
  notes: string | null;
  promotedToLeadId: number | null;
  customFields: Record<string, string> | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCrmMiningRowInput {
  serialNo?: string | undefined;
  minedDate?: string | undefined;
  domain?: string | undefined;
  companyName: string;
  hq?: string | undefined;
  website?: string | undefined;
  keyDecisionMakers?: string | undefined;
  title?: string | undefined;
  contactNumber?: string | undefined;
  email?: string | undefined;
  emailStatus?: string | undefined;
  followUpStatus?: string | undefined;
  industry?: string | undefined;
  numberOfEmployees?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  country?: string | undefined;
  linkedInProfile?: string | undefined;
  assignedTo?: string | undefined;
  priority?: string | undefined;
  nextFollowUpDate?: string | undefined;
  notes?: string | undefined;
  customFields?: Record<string, string> | undefined;
}

export type UpdateCrmMiningRowInput = Partial<CreateCrmMiningRowInput>;

export interface QueryCrmMiningRowsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  search?: string | undefined;
}
