import { z } from "zod";

/** Shared client-side validation for CRM Cold Calling Status entries —
 * mirrors apps/api/src/modules/crm/cold-calling/dto/cold-calling.dto.ts
 * exactly. Only `companyName` is required, matching legacy
 * `ColdCallingStatus.tsx`'s own minimal row shape (SINO / Date / Company
 * Name / Prospect Name / Designation / Status). */
const optionalStr = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createColdCallingEntrySchema = z.object({
  serialNo: optionalStr(50),
  callDate: optionalStr(40),
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(200, "Company name must be 200 characters or fewer"),
  prospectName: optionalStr(150),
  designation: optionalStr(150),
  status: z.string().max(2000).optional().or(z.literal("")),
});

export type CreateColdCallingEntryFormValues = z.infer<
  typeof createColdCallingEntrySchema
>;

export const updateColdCallingEntrySchema =
  createColdCallingEntrySchema.partial();
export type UpdateColdCallingEntryFormValues = z.infer<
  typeof updateColdCallingEntrySchema
>;

export const linkColdCallingEntrySchema = z.object({
  accountId: z.number().int().min(1, "Select an account"),
});
export type LinkColdCallingEntryFormValues = z.infer<
  typeof linkColdCallingEntrySchema
>;
