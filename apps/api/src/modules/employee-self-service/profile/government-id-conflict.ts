import { classifyDbError } from "../../../common/database/db-errors.js";
import { ResourceConflictException } from "../../../common/exceptions/business.exception.js";

/**
 * PAN and Aadhaar are unique per organization (partial unique indexes in
 * migration 20261011090000_hr_employee_gaps). Maps that violation to a 409
 * naming the identifier — never its value — and returns any other error
 * unchanged. Shared by the employee's own onboarding writes and HR's
 * sensitive-details writes, which both store into `employee_government_ids`.
 */
export function asGovernmentIdConflict(error: unknown): unknown {
  const violation = classifyDbError(error);
  if (violation?.kind !== "unique") return error;
  const where = [
    ...(violation.columns ?? []),
    violation.constraint ?? "",
    (error as { message?: string }).message ?? "",
  ].join(",");
  if (where.includes("pan")) {
    return new ResourceConflictException(
      "Another employee already has this PAN",
    );
  }
  if (where.includes("aadhaar")) {
    return new ResourceConflictException(
      "Another employee already has this Aadhaar number",
    );
  }
  return error;
}
