import { z } from "zod";

/** Shared client-side validation for CRM Leads — mirrors
 * apps/api/src/modules/crm/leads/dto/lead.dto.ts and the legacy
 * Leads.tsx client-side save guard (companyName/prospectName required). */
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

export const LEAD_PRIORITIES = ["High", "Medium", "Low"] as const;

const optionalString = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createLeadSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(200, "Company name must be 200 characters or fewer"),
  prospectName: z
    .string()
    .trim()
    .min(1, "Prospect name is required")
    .max(150, "Prospect name must be 150 characters or fewer"),
  domain: optionalString(200),
  hq: optionalString(200),
  industry: optionalString(100),
  annualRevenue: optionalString(50),
  numberOfEmployees: optionalString(50),
  title: optionalString(150),
  contactNumber: optionalString(30),
  mobile: optionalString(30),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  leadStatus: z.enum(LEAD_STATUSES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  assignedTo: optionalString(150),
  leadSource: optionalString(100),
  addressStreet: optionalString(250),
  city: optionalString(100),
  state: optionalString(100),
  postalCode: optionalString(20),
  country: optionalString(100),
  tags: optionalString(300),
  areaOfInterest: optionalString(2000),
  comments: optionalString(2000),
});

export type CreateLeadFormValues = z.infer<typeof createLeadSchema>;

export const convertLeadSchema = z.object({
  accountMode: z.enum(["new", "existing"]),
  existingAccountId: z.number().int().min(1).optional(),
  contactName: optionalString(150),
  contactTitle: optionalString(150),
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  contactPhone: optionalString(30),
  confirmDuplicate: z.boolean().optional(),
  createDeal: z.boolean().optional(),
  dealTitle: optionalString(200),
  dealAmount: z.number().min(0).optional(),
  dealCloseDate: optionalString(10),
  dealStageId: z.number().int().min(1).optional(),
  campaignSource: optionalString(150),
  contactRole: optionalString(150),
});

export type ConvertLeadFormValues = z.infer<typeof convertLeadSchema>;
