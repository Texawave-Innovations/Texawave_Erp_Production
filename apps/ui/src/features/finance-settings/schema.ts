import { requiredText } from "@texawave-erp/core";
import { z } from "zod";

/**
 * Feature-local zod schema mirroring
 * apps/api/src/modules/finance-settings/dto/create-master-list-item.dto.ts
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard"). Mirrors
 * apps/ui/src/features/sales-settings/schema.ts's `masterListItemSchema`.
 */
export const financeMasterListItemSchema = z.object({
  value: requiredText(200),
});
export type FinanceMasterListItemFormValues = z.infer<
  typeof financeMasterListItemSchema
>;
