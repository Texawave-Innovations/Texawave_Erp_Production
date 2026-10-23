import { requiredName } from "@texawave-erp/core";
import { z } from "zod";

/**
 * Feature-local zod schemas mirroring the relevant backend DTOs:
 * - apps/api/src/modules/departments/dto/*.ts
 * - apps/api/src/modules/master-data/designations/dto/*.ts
 * - apps/api/src/modules/master-data/work-locations/dto/*.ts
 * - apps/api/src/modules/hr/leave-types/dto/*.ts
 * - apps/api/src/modules/master-data/shifts/dto/*.ts
 *
 * Kept feature-local, not in packages/core, per Docs/HOW_TO_ADD_A_MODULE.md
 * "schema.ts" — nothing else references these shapes yet.
 */

/** Departments only need a 1–100 char name (no `code` field on the model). */
export const departmentNameSchema = z.object({
  name: requiredName(100),
});
export type DepartmentNameFormValues = z.infer<typeof departmentNameSchema>;

/** Designations / Office Locations / Leave Types / Shifts all require an
 * immutable `code` (CODE_PATTERN: starts with a letter, then A-Z0-9_, 2-30
 * chars — apps/api/src/common/dto/transforms.ts) alongside a 1–100 char
 * `name`. The chip-add UI only collects a name; `deriveCode` (./utils.ts)
 * generates a matching code from it. */
export const codedNameSchema = z.object({
  name: requiredName(100),
});
export type CodedNameFormValues = z.infer<typeof codedNameSchema>;
