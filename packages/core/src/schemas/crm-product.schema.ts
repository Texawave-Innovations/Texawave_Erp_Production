import { z } from "zod";

/** Shared client-side validation for CRM Products — mirrors
 * apps/api/src/modules/crm/products/dto/product.dto.ts. `code` is
 * deliberately NOT checked for uniqueness (approved decision D1,
 * Docs/CRM_PRODUCTS_LEGACY_PARITY.md §4) — legacy never enforces it on
 * manual create/edit either. `unitPrice` rejects negative values
 * (approved decision D3, an intentional safeguard, not a legacy
 * behavior). `taxPercent` has no upper bound (decision D2). */
const optionalString = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z.string().trim().min(1, "Code is required").max(100),
  category: optionalString(100),
  vendor: optionalString(150),
  unitPrice: z
    .number({ message: "Unit price is required" })
    .min(0, "Unit price cannot be negative"),
  taxPercent: z.number().min(0).optional(),
  description: optionalString(2000),
  isActive: z.boolean().default(true),
});

export type CreateProductFormValues = z.infer<typeof createProductSchema>;
