import type { Prisma } from "@texawave-erp/database";
import { formatDateOnly } from "../../../common/dates/date-only.js";
import type { EmployeeStatus } from "./employee-status.policy.js";

const NAME_ONLY = { select: { id: true, name: true } } as const;

/** What every employee read loads. Adding a relation here is how a new field
 * reaches the API — nothing else selects columns. */
export const EMPLOYEE_INCLUDE = {
  team: NAME_ONLY,
  department: NAME_ONLY,
  designation: NAME_ONLY,
  employmentType: NAME_ONLY,
  workLocation: NAME_ONLY,
  reportsTo: { select: { id: true, employeeCode: true, fullName: true } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeRow = Prisma.EmployeeGetPayload<{
  include: typeof EMPLOYEE_INCLUDE;
}>;

interface Ref {
  id: number;
  name: string;
}

/** List rows deliberately omit phone, e-mail and exit reason — personal data
 * is returned by the detail endpoint only (least exposure). */
export interface EmployeeListItem {
  id: number;
  employeeCode: string;
  fullName: string;
  status: EmployeeStatus;
  dateOfJoining: string;
  team: Ref;
  designation: Ref;
  employmentType: Ref;
  reportsToId: number | null;
  hasLogin: boolean;
}

export interface EmployeeDetail extends EmployeeListItem {
  workEmail: string | null;
  phone: string | null;
  department: Ref | null;
  workLocation: Ref | null;
  reportsTo: { id: number; employeeCode: string; fullName: string } | null;
  /** The linked platform user, if any. Never a credential. */
  userId: number | null;
  dateOfExit: string | null;
  exitReason: string | null;
  isActive: boolean;
  /** Send back on update (optimistic lock). */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toListItem(row: EmployeeRow): EmployeeListItem {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    status: row.status as EmployeeStatus,
    dateOfJoining: formatDateOnly(row.dateOfJoining),
    team: row.team,
    designation: row.designation,
    employmentType: row.employmentType,
    reportsToId: row.reportsToId,
    hasLogin: row.userId !== null,
  };
}

export function toDetail(row: EmployeeRow): EmployeeDetail {
  return {
    ...toListItem(row),
    workEmail: row.workEmail,
    phone: row.phone,
    department: row.department,
    workLocation: row.workLocation,
    reportsTo: row.reportsTo,
    userId: row.userId,
    dateOfExit: row.dateOfExit ? formatDateOnly(row.dateOfExit) : null,
    exitReason: row.exitReason,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Keeps the last two digits so a change is visible without logging the number. */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return `${"*".repeat(Math.max(digits.length - 2, 0))}${digits.slice(-2)}`;
}

/**
 * The allow-listed shape written to the audit trail — never the raw row.
 * Ids and status, not credentials; the phone number is masked; the exit
 * reason is omitted (it lives in `employee_status_history`, the business
 * record). A new column is NOT audited until it is added here on purpose.
 */
export function auditSnapshot(
  row: EmployeeRow | Prisma.EmployeeGetPayload<object>,
) {
  return {
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    workEmail: row.workEmail,
    phone: maskPhone(row.phone),
    userId: row.userId,
    status: row.status,
    teamId: row.teamId,
    departmentId: row.departmentId,
    designationId: row.designationId,
    employmentTypeId: row.employmentTypeId,
    workLocationId: row.workLocationId,
    reportsToId: row.reportsToId,
    dateOfJoining: formatDateOnly(row.dateOfJoining),
    dateOfExit: row.dateOfExit ? formatDateOnly(row.dateOfExit) : null,
    version: row.version,
  };
}
