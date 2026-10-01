import type { Prisma } from "@texawave-erp/database";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";

export interface EmployeeReferences {
  teamId?: number | undefined;
  departmentId?: number | null | undefined;
  designationId?: number | undefined;
  employmentTypeId?: number | undefined;
  workLocationId?: number | null | undefined;
  reportsToId?: number | null | undefined;
  userId?: number | null | undefined;
}

const invalid = (what: string, id: number, code: string) =>
  new BusinessRuleViolationException(
    `${what} ${id} does not exist in this organization or is inactive`,
    code,
  );

/**
 * Verifies every foreign id in `refs` belongs to `organizationId` and is
 * usable, INSIDE the caller's transaction. Only ids that are present (not
 * `undefined`/`null`) are checked, so an update re-validates exactly what it
 * changes and an already-stored reference to a since-deactivated designation
 * does not block an unrelated edit.
 *
 * Every lookup is org-scoped: a valid id from another organization is
 * indistinguishable from a non-existent one (same 422), so ids cannot be used
 * to probe another tenant.
 *
 * Returns the chosen team's department, so creation can default to it.
 */
export async function assertReferences(
  tx: Prisma.TransactionClient,
  organizationId: number,
  refs: EmployeeReferences,
  selfId?: number,
): Promise<{ teamDepartmentId: number | null }> {
  const live = { organizationId, deletedAt: null, isActive: true } as const;
  let teamDepartmentId: number | null = null;

  if (refs.teamId != null) {
    const team = await tx.team.findFirst({
      where: { id: refs.teamId, ...live },
      select: { departmentId: true },
    });
    if (!team) throw invalid("Team", refs.teamId, "INVALID_TEAM");
    teamDepartmentId = team.departmentId;
  }
  if (refs.departmentId != null) {
    const found = await tx.department.findFirst({
      where: { id: refs.departmentId, ...live },
      select: { id: true },
    });
    if (!found)
      throw invalid("Department", refs.departmentId, "INVALID_DEPARTMENT");
  }
  if (refs.designationId != null) {
    const found = await tx.designation.findFirst({
      where: { id: refs.designationId, ...live },
      select: { id: true },
    });
    if (!found)
      throw invalid("Designation", refs.designationId, "INVALID_DESIGNATION");
  }
  if (refs.employmentTypeId != null) {
    const found = await tx.employmentType.findFirst({
      where: { id: refs.employmentTypeId, ...live },
      select: { id: true },
    });
    if (!found) {
      throw invalid(
        "Employment type",
        refs.employmentTypeId,
        "INVALID_EMPLOYMENT_TYPE",
      );
    }
  }
  if (refs.workLocationId != null) {
    const found = await tx.workLocation.findFirst({
      where: { id: refs.workLocationId, ...live },
      select: { id: true },
    });
    if (!found)
      throw invalid(
        "Work location",
        refs.workLocationId,
        "INVALID_WORK_LOCATION",
      );
  }

  if (refs.reportsToId != null) {
    if (selfId !== undefined && refs.reportsToId === selfId) {
      throw new BusinessRuleViolationException(
        "An employee cannot report to themselves",
        "REPORTING_LINE_CYCLE",
      );
    }
    const manager = await tx.employee.findFirst({
      where: {
        id: refs.reportsToId,
        organizationId,
        deletedAt: null,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!manager) throw invalid("Manager", refs.reportsToId, "INVALID_MANAGER");
    if (
      selfId !== undefined &&
      (await wouldCreateCycle(tx, selfId, refs.reportsToId))
    ) {
      throw new BusinessRuleViolationException(
        "That reporting line would make the employee (indirectly) report to themselves",
        "REPORTING_LINE_CYCLE",
      );
    }
  }

  if (refs.userId != null) {
    const user = await tx.user.findFirst({
      where: { id: refs.userId, ...live },
      select: { id: true },
    });
    if (!user) throw invalid("User", refs.userId, "INVALID_USER");
    const taken = await tx.employee.findFirst({
      where: {
        userId: refs.userId,
        ...(selfId !== undefined ? { NOT: { id: selfId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      throw new ResourceConflictException(
        "That user account is already linked to another employee",
      );
    }
  }

  return { teamDepartmentId };
}

/** True if following `reports_to` upward from `managerId` reaches `employeeId`. */
async function wouldCreateCycle(
  tx: Prisma.TransactionClient,
  employeeId: number,
  managerId: number,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    WITH RECURSIVE chain(id, reports_to_id) AS (
      SELECT id, reports_to_id FROM employees WHERE id = ${managerId}
      UNION
      SELECT e.id, e.reports_to_id
        FROM employees e JOIN chain c ON e.id = c.reports_to_id
    )
    SELECT id FROM chain WHERE id = ${employeeId} LIMIT 1`;
  return rows.length > 0;
}
