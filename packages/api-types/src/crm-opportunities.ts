// HANDWRITTEN — mirrors apps/api/src/modules/crm/opportunities/. Migrated
// from the LIVE legacy TexaWave_ERP/src/modules/crm/Pipeline.tsx +
// domain/opportunitiesService.ts + domain/OpportunityDrawer.tsx. See
// packages/api-types/README.md.

import type { Account } from "./crm-accounts.js";
import type { Contact } from "./crm-contacts.js";
import type { PipelineStage } from "./crm-pipeline-stages.js";

export const OPPORTUNITY_STATUSES = ["OPEN", "WON", "LOST", "ON_HOLD"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const OPPORTUNITY_PRIORITIES = ["High", "Medium", "Low"] as const;

export const LOST_REASONS = [
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
] as const;

export const HOLD_REASONS = [
  "Budget Freeze",
  "Client Requested Pause",
  "Internal Priority Change",
  "Awaiting Approval",
  "Awaiting Documentation",
  "Resourcing Constraint",
  "Other",
] as const;

export const STUCK_REASONS = [
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
] as const;

export interface Opportunity {
  id: number;
  organizationId: number;
  teamId: number | null;
  accountId: number;
  account: Pick<Account, "id" | "name">;
  contactId: number | null;
  contact: Pick<Contact, "id" | "name"> | null;
  leadId: number | null;
  opportunityNumber: string;
  title: string;
  ownerName: string;
  stageId: number;
  stage: PipelineStage;
  stageEnteredAt: string;
  estimatedValue: string;
  currency: string | null;
  expectedCloseDate: string | null;
  probability: number | null;
  priority: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  lastActivityAt: string | null;
  status: OpportunityStatus;
  lostReason: string | null;
  lostReasonOther: string | null;
  lostAt: string | null;
  competitor: string | null;
  holdReason: string | null;
  holdReasonOther: string | null;
  expectedResumeDate: string | null;
  holdNotes: string | null;
  onHoldAt: string | null;
  resumedAt: string | null;
  stuckReason: string | null;
  stuckReasonOther: string | null;
  contactRole: string | null;
  forecastCategory: string | null;
  campaignSource: string | null;
  closingAmount: string | null;
  closingDate: string | null;
  wonAt: string | null;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface OpportunityStageHistoryEntry {
  id: number;
  opportunityId: number;
  fromStageId: number | null;
  fromStage: Pick<PipelineStage, "id" | "code" | "label"> | null;
  toStageId: number;
  toStage: Pick<PipelineStage, "id" | "code" | "label">;
  changedBy: number | null;
  changedByName?: string | null | undefined;
  changedAt: string;
  remarks: string | null;
}

export interface CreateOpportunityInput {
  accountId: number;
  contactId?: number | undefined;
  title: string;
  ownerName: string;
  stageId: number;
  estimatedValue: number;
  currency?: string | undefined;
  expectedCloseDate?: string | undefined;
  priority?: string | undefined;
  probability?: number | undefined;
  nextAction?: string | undefined;
  nextActionDate?: string | undefined;
  campaignSource?: string | undefined;
  contactRole?: string | undefined;
  forecastCategory?: string | undefined;
}

export type UpdateOpportunityInput = Partial<
  Omit<CreateOpportunityInput, "stageId">
>;

export interface QueryOpportunitiesInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  q?: string | undefined;
  accountId?: number | undefined;
  stageId?: number | undefined;
  status?: OpportunityStatus | undefined;
}

export interface ChangeStageInput {
  stageId: number;
  remarks?: string | undefined;
}

export interface MarkWonInput {
  closingAmount?: number | undefined;
  closingDate?: string | undefined;
  remarks?: string | undefined;
}

export interface MarkLostInput {
  reason: string;
  reasonOther?: string | undefined;
  remarks?: string | undefined;
  competitor?: string | undefined;
}

export interface SetOnHoldInput {
  reason: string;
  reasonOther?: string | undefined;
  expectedResumeDate?: string | undefined;
  notes?: string | undefined;
}

export interface ReopenInput {
  stageId: number;
}

export interface SetStuckReasonInput {
  reason: string;
  reasonOther?: string | undefined;
}

/** Deal line item — migrated from legacy's `CrmDealProduct`. `productName`/
 * `unitPrice`/`taxPercent` are a frozen snapshot taken when the line was
 * added; they never change even if the catalog `Product` is later
 * renamed, re-priced, or deactivated. See
 * Docs/CRM_PRODUCTS_LEGACY_PARITY.md §2.6. */
export interface OpportunityProduct {
  id: number;
  organizationId: number;
  opportunityId: number;
  productId: number;
  product: { id: number; code: string; isActive: boolean };
  productName: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string | null;
  taxPercent: string | null;
  total: string;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AddOpportunityProductItemInput {
  productId: number;
  quantity: number;
  discountPercent?: number | undefined;
}

export interface AddOpportunityProductsInput {
  items: AddOpportunityProductItemInput[];
}

export interface UpdateOpportunityProductInput {
  quantity?: number | undefined;
  discountPercent?: number | undefined;
}
