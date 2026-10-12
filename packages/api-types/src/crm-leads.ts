// HANDWRITTEN — mirrors apps/api/src/modules/crm/leads/. Migrated from the
// LIVE legacy TexaWave_ERP/src/modules/crm/Leads.tsx +
// domain/LeadConvertDialog.tsx (RTDB `crm/leads`). See
// packages/api-types/README.md.

import type { Account } from "./crm-accounts.js";
import type { Contact } from "./crm-contacts.js";
import type { Opportunity } from "./crm-opportunities.js";

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "NOT_INTERESTED",
  "FOLLOW_UP",
  "MEETING_PENDING",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_PRIORITIES = ["High", "Medium", "Low"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export interface Lead {
  id: number;
  organizationId: number;
  teamId: number | null;
  companyName: string;
  domain: string | null;
  hq: string | null;
  industry: string | null;
  annualRevenue: string | null;
  numberOfEmployees: string | null;
  prospectName: string;
  title: string | null;
  contactNumber: string | null;
  mobile: string | null;
  email: string | null;
  fax: string | null;
  skypeId: string | null;
  meetingStatus: string | null;
  meetingScheduled: string | null;
  meetingDate: string | null;
  leadStatus: LeadStatus;
  priority: string | null;
  assignedTo: string | null;
  leadSource: string | null;
  emailOptOut: boolean;
  dataProcessingBasis: string | null;
  addressStreet: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  tags: string | null;
  areaOfInterest: string | null;
  comments: string | null;
  linkedAccountId: number | null;
  linkedAccount: Pick<Account, "id" | "name"> | null;
  linkedContactId: number | null;
  linkedContact: Pick<Contact, "id" | "name"> | null;
  linkedOpportunityId: number | null;
  linkedOpportunity: Pick<
    Opportunity,
    "id" | "title" | "opportunityNumber"
  > | null;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateLeadInput {
  companyName: string;
  prospectName: string;
  domain?: string | undefined;
  hq?: string | undefined;
  industry?: string | undefined;
  annualRevenue?: string | undefined;
  numberOfEmployees?: string | undefined;
  title?: string | undefined;
  contactNumber?: string | undefined;
  mobile?: string | undefined;
  email?: string | undefined;
  fax?: string | undefined;
  skypeId?: string | undefined;
  meetingStatus?: string | undefined;
  meetingScheduled?: string | undefined;
  meetingDate?: string | undefined;
  leadStatus?: LeadStatus | undefined;
  priority?: string | undefined;
  assignedTo?: string | undefined;
  leadSource?: string | undefined;
  emailOptOut?: boolean | undefined;
  dataProcessingBasis?: string | undefined;
  addressStreet?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  postalCode?: string | undefined;
  country?: string | undefined;
  tags?: string | undefined;
  areaOfInterest?: string | undefined;
  comments?: string | undefined;
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

export interface QueryLeadsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  q?: string | undefined;
  leadStatus?: LeadStatus | undefined;
  assignedTo?: string | undefined;
  leadSource?: string | undefined;
  industry?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
}

export interface ConvertLeadInput {
  accountMode: "new" | "existing";
  existingAccountId?: number | undefined;
  contactName?: string | undefined;
  contactTitle?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  confirmDuplicate?: boolean | undefined;
  createDeal?: boolean | undefined;
  dealTitle?: string | undefined;
  dealAmount?: number | undefined;
  dealCloseDate?: string | undefined;
  dealStageId?: number | undefined;
  campaignSource?: string | undefined;
  contactRole?: string | undefined;
}
