import { z } from "zod";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/attendance/dto/attendance.dto.ts so the form fails
 * the way the API would, before a round trip. The backend remains
 * authoritative.
 */
export const editableSessionSchema = z.object({
  checkInAt: z.string().min(1, "Check-in time is required"),
  checkOutAt: z.string(),
});

export type EditableSession = z.infer<typeof editableSessionSchema>;

export const manualEditSchema = z.object({
  status: z.union([
    z.literal("PRESENT"),
    z.literal("ABSENT"),
    z.literal("HALF_DAY"),
    z.literal(""),
  ]),
  sessions: z
    .array(editableSessionSchema)
    .max(20, "At most 20 sessions per day"),
});

export type ManualEditValues = z.infer<typeof manualEditSchema>;
