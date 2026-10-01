import { Injectable } from "@nestjs/common";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { lockEmployee } from "./employee-lock.js";
import {
  EMPLOYEE_INCLUDE,
  auditSnapshot,
  type EmployeeRow,
} from "./employee-mappers.js";
import { assertReferences } from "./employee-references.js";
import {
  assertCorrection,
  assertTransition,
  isExitStatus,
  type EmployeeStatus,
} from "./employee-status.policy.js";

const ENTITY_TYPE = "employee";

export interface StatusChange {
  to: EmployeeStatus;
  effectiveDate: string;
  reason: string;
  /** `true` = the audited correction workflow (the only exit from RESIGNED/TERMINATED). */
  correction: boolean;
}

export interface StatusChangeResult {
  employee: EmployeeRow;
  /** Linked login switched off because the employee left — its sessions must
   * be revoked by the caller after this transaction commits. */
  disabledUserId: number | null;
  /** Linked login switched back on by a reinstating correction. */
  enabledUserId: number | null;
}

/** Status changes and login linking. Every method locks the employee row,
 * validates against the freshly read state, and writes the change, its
 * history/audit rows in ONE transaction. */
@Injectable()
export class EmployeeLifecycleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async changeStatus(
    scope: OrgScope,
    id: number,
    change: StatusChange,
    actorId: number,
  ): Promise<StatusChangeResult | null> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockEmployee(tx, scope.organizationId, id))) return null;
      const before = await tx.employee.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
        include: EMPLOYEE_INCLUDE,
      });
      const from = before.status as EmployeeStatus;

      if (change.correction) assertCorrection(from, change.to);
      else assertTransition(from, change.to);

      const effective = parseDateOnly(change.effectiveDate);
      if (effective < before.dateOfJoining) {
        throw new BusinessRuleViolationException(
          "The effective date cannot be before the date of joining",
          "EFFECTIVE_DATE_BEFORE_JOINING",
        );
      }

      const leaving = isExitStatus(change.to);
      const after = await tx.employee.update({
        where: { id },
        data: {
          status: change.to,
          isActive: change.to === "ACTIVE",
          // Exit fields exist exactly while the employee has left (DB CHECK).
          dateOfExit: leaving ? effective : null,
          exitReason: leaving ? change.reason : null,
          version: { increment: 1 },
          updatedBy: actorId,
        },
        include: EMPLOYEE_INCLUDE,
      });

      await tx.employeeStatusHistory.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: id,
          fromStatus: from,
          toStatus: change.to,
          changeType: change.correction ? "correction" : "transition",
          effectiveDate: effective,
          reason: change.reason,
          changedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: change.correction ? "status_correction" : "status_change",
        before: auditSnapshot(before),
        after: auditSnapshot(after),
        reason: change.reason,
      });

      let disabledUserId: number | null = null;
      let enabledUserId: number | null = null;
      if (after.userId !== null) {
        const user = await tx.user.findUnique({
          where: { id: after.userId },
          select: { id: true, isActive: true },
        });
        if (user && leaving && user.isActive) {
          // A leaver must not be able to log in. Done in the same
          // transaction so the status and the login can never disagree.
          await tx.user.update({
            where: { id: user.id },
            data: { isActive: false, updatedBy: actorId },
          });
          await this.audit.write(tx, {
            entityType: "user",
            entityId: user.id,
            action: "deactivate",
            before: { isActive: true },
            after: { isActive: false },
            reason: `employee ${after.employeeCode} ${change.to.toLowerCase()}`,
          });
          disabledUserId = user.id;
        } else if (
          user &&
          change.correction &&
          change.to === "ACTIVE" &&
          !user.isActive
        ) {
          await tx.user.update({
            where: { id: user.id },
            data: { isActive: true, updatedBy: actorId },
          });
          await this.audit.write(tx, {
            entityType: "user",
            entityId: user.id,
            action: "activate",
            before: { isActive: false },
            after: { isActive: true },
            reason: `employee ${after.employeeCode} reinstated by status correction`,
          });
          enabledUserId = user.id;
        }
      }
      return { employee: after, disabledUserId, enabledUserId };
    });
  }

  /** Links an existing platform user to the employee (1:1). Idempotent for
   * the same user; refuses a different user until the current one is unlinked,
   * and refuses employees who have left. */
  @OrgScoped()
  async linkUser(
    scope: OrgScope,
    id: number,
    userId: number,
    reason: string | undefined,
    actorId: number,
  ): Promise<EmployeeRow | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockEmployee(tx, scope.organizationId, id))) return null;
        const before = await tx.employee.findFirstOrThrow({
          where: { id, organizationId: scope.organizationId },
          include: EMPLOYEE_INCLUDE,
        });
        if (before.userId === userId) return before;
        if (isExitStatus(before.status as EmployeeStatus)) {
          throw new BusinessRuleViolationException(
            "A login cannot be linked to an employee who has left",
            "EMPLOYEE_HAS_LEFT",
          );
        }
        if (before.userId !== null) {
          throw new ResourceConflictException(
            "This employee is already linked to a different user — unlink it first",
          );
        }
        await assertReferences(tx, scope.organizationId, { userId }, id);

        const after = await tx.employee.update({
          where: { id },
          data: { userId, version: { increment: 1 }, updatedBy: actorId },
          include: EMPLOYEE_INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "link_user",
          before: { userId: null },
          after: { userId },
          reason,
        });
        return after;
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  /** Detaches the login. The user account itself is untouched. Idempotent. */
  @OrgScoped()
  async unlinkUser(
    scope: OrgScope,
    id: number,
    reason: string | undefined,
    actorId: number,
  ): Promise<EmployeeRow | null> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockEmployee(tx, scope.organizationId, id))) return null;
      const before = await tx.employee.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
        include: EMPLOYEE_INCLUDE,
      });
      if (before.userId === null) return before;

      const after = await tx.employee.update({
        where: { id },
        data: { userId: null, version: { increment: 1 }, updatedBy: actorId },
        include: EMPLOYEE_INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "unlink_user",
        before: { userId: before.userId },
        after: { userId: null },
        reason,
      });
      return after;
    });
  }

  private asConflict(error: unknown): unknown {
    return classifyDbError(error)?.kind === "unique"
      ? new ResourceConflictException(
          "That user account is already linked to another employee",
        )
      : error;
  }
}
