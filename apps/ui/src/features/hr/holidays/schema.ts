import { z } from "zod";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/holidays/dto/holiday.dto.ts so the form fails the
 * way the API would, before a round trip. The backend remains authoritative.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const createHolidaySchema = z.object({
  holidayDate: z.string().refine((v) => ISO_DATE.test(v), {
    message: "Date is required",
  }),
  name: z
    .string()
    .trim()
    .min(1, "Holiday name is required")
    .max(150, "Holiday name must be 150 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer"),
  workLocationId: z.string(),
});

export type CreateHolidayValues = z.infer<typeof createHolidaySchema>;

export const EMPTY_CREATE_FORM: CreateHolidayValues = {
  holidayDate: "",
  name: "",
  description: "",
  workLocationId: "",
};

export const updateHolidaySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Holiday name is required")
    .max(150, "Holiday name must be 150 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer"),
});

export type UpdateHolidayValues = z.infer<typeof updateHolidaySchema>;
