import { requiredText } from "@texawave-erp/core";
import { z } from "zod";

/**
 * Feature-local zod schema mirroring
 * apps/api/src/modules/scm/master-list-items/dto/create-master-list-item.dto.ts
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard"). Mirrors
 * apps/ui/src/features/finance-settings/schema.ts's
 * `financeMasterListItemSchema`.
 */
export const scmMasterListItemSchema = z.object({
  value: requiredText(200),
});
export type ScmMasterListItemFormValues = z.infer<
  typeof scmMasterListItemSchema
>;
