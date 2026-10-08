import { z } from "zod";
import type { EmployeeDetail, EmployeeStatus } from "./types";

/**
 * Client-side UX validation only. It mirrors apps/api/src/modules/hr/employees/
 * dto/*.ts so the form fails the way the API would, before a round trip. The
 * backend remains authoritative.
 */
const PHONE_PATTERN = /^[0-9+()\-\s]{6,20}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const optionalId = z
  .string()
  .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0), {
    message: "Enter a valid ID",
  });

const requiredId = z
  .string()
  .min(1, "Required")
  .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
    message: "Enter a valid ID",
  });

export const employeeFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(200, "Full name must be 200 characters or fewer"),
  workEmail: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "Enter a valid work email",
    }),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE_PATTERN.test(v), {
      message: "Phone must be 6–20 digits, spaces, + ( ) or -",
    }),
  teamId: requiredId,
  departmentId: optionalId,
  designationId: requiredId,
  employmentTypeId: requiredId,
  workLocationId: optionalId,
  reportsToId: optionalId,
  dateOfJoining: z
    .string()
    .min(1, "Date of joining is required")
    .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" }),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const EMPTY_FORM: EmployeeFormValues = {
  fullName: "",
  workEmail: "",
  phone: "",
  teamId: "",
  departmentId: "",
  designationId: "",
  employmentTypeId: "",
  workLocationId: "",
  reportsToId: "",
  dateOfJoining: "",
};

export function formFromDetail(e: EmployeeDetail): EmployeeFormValues {
  return {
    fullName: e.fullName,
    workEmail: e.workEmail ?? "",
    phone: e.phone ?? "",
    teamId: String(e.team.id),
    departmentId: e.department ? String(e.department.id) : "",
    designationId: String(e.designation.id),
    employmentTypeId: String(e.employmentType.id),
    workLocationId: e.workLocation ? String(e.workLocation.id) : "",
    reportsToId: e.reportsTo ? String(e.reportsTo.id) : "",
    dateOfJoining: e.dateOfJoining,
  };
}

type Payload = Record<string, unknown>;

const toNum = (v: string) => Number(v);

/** Create body: only what the API accepts; empty optional fields are omitted. */
export function buildCreatePayload(v: EmployeeFormValues): Payload {
  const body: Payload = {
    fullName: v.fullName.trim(),
    teamId: toNum(v.teamId),
    designationId: toNum(v.designationId),
    employmentTypeId: toNum(v.employmentTypeId),
    dateOfJoining: v.dateOfJoining,
  };
  if (v.workEmail.trim()) body.workEmail = v.workEmail.trim();
  if (v.phone.trim()) body.phone = v.phone.trim();
  if (v.departmentId) body.departmentId = toNum(v.departmentId);
  if (v.workLocationId) body.workLocationId = toNum(v.workLocationId);
  if (v.reportsToId) body.reportsToId = toNum(v.reportsToId);
  return body;
}

/**
 * Update body: only fields that changed, plus the `version` read with the
 * record (optimistic lock). Cleared optional fields are sent as `null`.
 * Sending unchanged team/designation/etc. would trip the team-scope rule
 * that restricts those fields to `.all` writers.
 */
export function buildUpdatePayload(
  initial: EmployeeFormValues,
  v: EmployeeFormValues,
  version: number,
): Payload {
  const body: Payload = { version };
  if (v.fullName.trim() !== initial.fullName) body.fullName = v.fullName.trim();

  const nullableText = (key: "workEmail" | "phone") => {
    const next = v[key].trim();
    if (next !== initial[key].trim()) body[key] = next === "" ? null : next;
  };
  nullableText("workEmail");
  nullableText("phone");

  const requiredNum = (
    key: "teamId" | "designationId" | "employmentTypeId",
  ) => {
    if (v[key] !== initial[key]) body[key] = toNum(v[key]);
  };
  requiredNum("teamId");
  requiredNum("designationId");
  requiredNum("employmentTypeId");

  const nullableNum = (
    key: "departmentId" | "workLocationId" | "reportsToId",
  ) => {
    if (v[key] !== initial[key])
      body[key] = v[key] === "" ? null : toNum(v[key]);
  };
  nullableNum("departmentId");
  nullableNum("workLocationId");
  nullableNum("reportsToId");

  if (v.dateOfJoining !== initial.dateOfJoining) {
    body.dateOfJoining = v.dateOfJoining;
  }
  return body;
}

export const statusChangeSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"]),
  effectiveDate: z
    .string()
    .min(1, "Effective date is required")
    .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" }),
  reason: z
    .string()
    .trim()
    .min(3, "Give a reason of at least 3 characters")
    .max(500, "Reason must be 500 characters or fewer"),
});

export type StatusChangeValues = z.infer<typeof statusChangeSchema>;

export function statusTargetAllowed(
  targets: readonly EmployeeStatus[],
  status: string,
): status is EmployeeStatus {
  return (targets as readonly string[]).includes(status);
}

/** Optional reason mirroring LinkEmployeeUserDto/UnlinkEmployeeUserDto: when
 * given it must be 3–500 characters, same as the status-change reason. */
const optionalReason = z
  .string()
  .trim()
  .refine((v) => v === "" || (v.length >= 3 && v.length <= 500), {
    message: "Reason must be 3–500 characters",
  });

export const linkAccountSchema = z.object({
  userId: requiredId,
  reason: optionalReason,
});

export type LinkAccountValues = z.infer<typeof linkAccountSchema>;

export const unlinkAccountSchema = z.object({
  reason: optionalReason,
});

export type UnlinkAccountValues = z.infer<typeof unlinkAccountSchema>;
