import { z } from "zod";

/**
 * Feature-local zod schemas mirroring
 * apps/api/src/modules/projects/proposals/dto/*.ts (Docs/CODING_STANDARDS.md
 * "Frontend API/state/error standard").
 */

export const createProposalDocumentSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  projectId: z.number().int().positive().optional(),
  projectName: z.string().trim().max(200).optional(),
  clientId: z.number().int().positive().optional(),
  clientName: z.string().trim().max(200).optional(),
  templateId: z.number().int().positive().optional(),
  proposalDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
});
export type CreateProposalDocumentFormValues = z.infer<
  typeof createProposalDocumentSchema
>;

export const createProposalTemplateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(200),
  title: z.string().trim().min(2, "Title is required").max(200),
  code: z.string().trim().max(30).optional(),
  description: z.string().trim().max(1000).optional(),
  department: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
});
export type CreateProposalTemplateFormValues = z.infer<
  typeof createProposalTemplateSchema
>;

export const proposalSettingsSchema = z.object({
  companyName: z.string().trim().max(200).optional(),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  website: z.string().trim().max(200).optional(),
  address: z.string().trim().max(500).optional(),
  prefix: z.string().trim().min(1).max(20).optional(),
  yearFormat: z.enum(["YYYY", "YY", "NONE"]).optional(),
  sequenceDigits: z.number().int().min(1).max(8).optional(),
});
export type ProposalSettingsFormValues = z.infer<typeof proposalSettingsSchema>;
