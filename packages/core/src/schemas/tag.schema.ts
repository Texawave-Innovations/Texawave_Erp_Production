import { TAG_COLOR_TOKENS } from "@texawave-erp/api-types";
import { z } from "zod";

/** Shared client-side validation for the reference `tags` fixture form —
 * mirrors apps/api/src/modules/_reference/tags/dto/create-tag.dto.ts so the
 * form fails the same way the API would, before a round trip
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard"). */
export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  colorToken: z.enum(TAG_COLOR_TOKENS).default("gray"),
});

export type CreateTagFormValues = z.infer<typeof createTagSchema>;
