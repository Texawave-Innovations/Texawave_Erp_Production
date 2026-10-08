import { z } from "zod";
import { strongPasswordSchema } from "./user.schema";

const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
const NAME_MSG = "Enter a valid name (letters only).";

/** Mirrors apps/api/src/modules/hr/employees/dto/create-employee.dto.ts and
 * the users create DTO, for the HR "New hire" form (TEXA-16 onboarding). */
export const newHireSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50)
    .regex(NAME_RE, NAME_MSG),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(50)
    .regex(NAME_RE, NAME_MSG),
  mobile: z
    .string()
    .trim()
    .regex(
      /^[6-9]\d{9}$/,
      "Enter a valid 10-digit mobile number starting with 6 to 9.",
    ),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  roleId: z.number().int().positive().optional(),
  departmentId: z.number().int().positive("Select a department."),
  teamId: z.number().int().positive("Select a team."),
  designationId: z.number().int().positive("Select a designation."),
  employmentTypeId: z.number().int().positive("Select an employment type."),
  dateOfJoining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date."),
  tempPassword: strongPasswordSchema,
});

export type NewHireFormValues = z.infer<typeof newHireSchema>;
