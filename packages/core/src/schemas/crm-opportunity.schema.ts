import { z } from "zod";

/** Shared client-side validation for CRM Opportunities/Pipeline Stages —
 * mirrors apps/api/src/modules/crm/opportunities/dto/opportunity.dto.ts
 * and apps/api/src/modules/crm/pipeline-stages/dto/pipeline-stage.dto.ts. */
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

const optionalString = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createOpportunitySchema = z.object({
  accountId: z.number({ message: "Account is required" }).int().min(1),
  contactId: z.number().int().min(1).optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  ownerName: z.string().trim().min(1, "Owner is required").max(150),
  stageId: z.number({ message: "Stage is required" }).int().min(1),
  estimatedValue: z.number({ message: "Estimated value is required" }).min(0),
  currency: optionalString(10),
  expectedCloseDate: optionalString(10),
  priority: z.enum(OPPORTUNITY_PRIORITIES).optional(),
  campaignSource: optionalString(150),
  contactRole: optionalString(150),
});

export type CreateOpportunityFormValues = z.infer<
  typeof createOpportunitySchema
>;

export const createPipelineStageSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
  slaDays: z.number().int().min(0).optional(),
  probability: z.number().int().min(0).max(100).optional(),
});

export type CreatePipelineStageFormValues = z.infer<
  typeof createPipelineStageSchema
>;

export const markLostSchema = z.object({
  reason: z.enum(LOST_REASONS),
  reasonOther: optionalString(300),
  remarks: optionalString(500),
  competitor: optionalString(150),
});

export const setOnHoldSchema = z.object({
  reason: z.enum(HOLD_REASONS),
  reasonOther: optionalString(300),
  expectedResumeDate: optionalString(10),
  notes: optionalString(500),
});

export const setStuckReasonSchema = z.object({
  reason: z.enum(STUCK_REASONS),
  reasonOther: optionalString(300),
});
