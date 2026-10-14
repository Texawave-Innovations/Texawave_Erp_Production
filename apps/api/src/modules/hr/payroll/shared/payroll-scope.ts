import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import type { Prisma } from "@texawave-erp/database";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";

/**
 * Payroll periods, runs, payslip generation and payment batches act on the
 * whole organization at once, so only an `.all` grant may perform them — a
 * `.team` holder would otherwise process, approve or pay employees outside
 * their teams (Docs/PAYROLL_AND_COMPLIANCE.md "Access scope").
 */
export function requireOrgWideScope(scope: TeamScope, action: string): void {
  if (scope.level !== "all") {
    throw new ForbiddenException(
      `You may not ${action}: this operation covers the whole organization and requires an organization-wide (.all) grant`,
    );
  }
}

/**
 * Fails (as "not found", so existence is not leaked) when a single-employee
 * write targets an employee outside the caller's scope. `.own` grants no
 * write access to payroll data at all: nobody edits their own pay.
 */
export function assertEmployeeInWriteScope(
  scope: TeamScope,
  employee: { id: number; teamId: number; userId: number | null },
): void {
  if (scope.level === "all") return;
  if (scope.level === "team" && scope.teamIds.includes(employee.teamId)) {
    return;
  }
  throw new ResourceNotFoundException("Employee", employee.id);
}

/** Maker-checker: the person who created a record (or whom it pays) may not
 * approve it. */
export function assertNotSelfApproval(
  createdById: number | null | undefined,
  approverId: number,
  what: string,
): void {
  if (createdById != null && createdById === approverId) {
    throw new ForbiddenException(
      `Maker-checker: you cannot approve this ${what} yourself`,
    );
  }
}

/**
 * The employee a single-employee payroll write targets, read THROUGH the
 * caller's write scope (`teamWhere`), for `@TeamScoped()` repository methods
 * (Docs/CODING_STANDARDS.md §10a): `.own` never writes pay, `.team` reaches
 * only its teams, and anything outside is "not found". Pass the transaction
 * client so the check and the write see the same data.
 */
export async function findEmployeeInWriteScope(
  db: Pick<Prisma.TransactionClient, "employee">,
  scope: TeamScope,
  employeeId: number,
) {
  if (scope.level === "own") {
    throw new ResourceNotFoundException("Employee", employeeId);
  }
  const employee = await db.employee.findFirst({
    where: teamWhere(scope, {
      id: employeeId,
      deletedAt: null,
    }) as Prisma.EmployeeWhereInput,
    select: {
      id: true,
      teamId: true,
      userId: true,
      employeeCode: true,
      fullName: true,
    },
  });
  if (!employee) throw new ResourceNotFoundException("Employee", employeeId);
  return employee;
}
