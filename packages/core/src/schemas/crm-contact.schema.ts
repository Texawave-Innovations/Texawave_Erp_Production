import { z } from "zod";

/** Shared client-side validation for CRM Contacts — mirrors
 * apps/api/src/modules/crm/contacts/dto/contact.dto.ts and the legacy
 * Contacts.tsx client-side save guard
 * (`if (!form.name.trim() || !form.accountId) return;`). */
export const createContactSchema = z.object({
  accountId: z.number({ message: "Account is required" }).int().min(1),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(150, "Name must be 150 characters or fewer"),
  designation: z.string().trim().max(150).optional(),
  department: z.string().trim().max(150).optional(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  isPrimary: z.boolean().default(false),
  isDecisionMaker: z.boolean().default(false),
});

export type CreateContactFormValues = z.infer<typeof createContactSchema>;
