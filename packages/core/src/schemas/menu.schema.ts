import { z } from "zod";

/**
 * Shared client-side validation for menu feature — mirrors
 * apps/api/src/modules/menu/dto/create-menu-item.dto.ts
 */
export const createMenuItemSchema = z.object({
  code: z
    .string()
    .min(1, "Code is required")
    .max(100, "Code must be 100 characters or fewer"),
  label: z
    .string()
    .min(1, "Label is required")
    .max(100, "Label must be 100 characters or fewer"),
  path: z.string().max(255).optional().or(z.literal("")),
  icon: z.string().max(100).optional().or(z.literal("")),
  order: z.number().int().default(0),
  parentId: z.number().int().positive().nullable().optional(),
  permission: z.string().max(100).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type CreateMenuItemFormValues = z.infer<typeof createMenuItemSchema>;
