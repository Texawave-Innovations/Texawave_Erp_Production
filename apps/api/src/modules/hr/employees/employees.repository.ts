import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { classifyDbError } from "../../../common/database/db-errors.js";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  VersionConflictException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { issueEmployeeCode } from "./employee-code.js";
import { lockEmployee } from "./employee-lock.js";
import {
  EMPLOYEE_INCLUDE,
  auditSnapshot,
  type EmployeeRow,
} from "./employee-mappers.js";
import { assertReferences } from "./employee-references.js";
import type { EmployeeStatus } from "./employee-status.policy.js";

const ENTITY_TYPE = "employee";

export interface EmployeeFilter {
  search?: string | undefined;
  status?: EmployeeStatus | undefined;
  teamId?: number | undefined;
  departmentId?: number | undefined;
  designationId?: number | undefined;
  employmentTypeId?: number | undefined;
  workLocationId?: number | undefined;
  reportsToId?: number | undefined;
  hasUser?: boolean | undefined;
  joinedFrom?: string | undefined;
  joinedTo?: string | undefined;
  sortBy?:
    | "employeeCode"
    | "fullName"
    | "dateOfJoining"
    | "status"
    | "createdAt"
    | undefined;
}

export interface NewEmployee {
  fullName: string;
  workEmail?: string | undefined;
  phone?: string | undefined;
  teamId: number;
  departmentId?: number | undefined;
  designationId: number;
  employmentTypeId: number;
  workLocationId?: number | undefined;
  reportsToId?: number | undefined;
  dateOfJoining: string;
  userId?: number | undefined;
}

export interface EmployeePatch {
  version: number;
  fullName?: string | undefined;
  workEmail?: string | null | undefined;
  phone?: string | null | undefined;
  teamId?: number | undefined;
  departmentId?: number | null | undefined;
  designationId?: number | undefined;
  employmentTypeId?: number | undefined;
  workLocationId?: number | null | undefined;
  reportsToId?: number | null | undefined;
  dateOfJoining?: string | undefined;
}

/** Only place `PrismaService` is called for employee data. Reads are scoped
 * by `teamWhere()` (organization always, then own/team/all); every write is
 * one transaction holding the employee row lock, the change, its history and
 * its audit row. */
@Injectable()
export class EmployeesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  // ---- reads ---------------------------------------------------------------

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: EmployeeFilter,
    pagination: PaginationDto,
  ) {
    const where: Prisma.EmployeeWhereInput = teamWhere(scope, {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.teamId !== undefined ? { teamId: filter.teamId } : {}),
      ...(filter.departmentId !== undefined
        ? { departmentId: filter.departmentId }
        : {}),
      ...(filter.designationId !== undefined
        ? { designationId: filter.designationId }
        : {}),
      ...(filter.employmentTypeId !== undefined
        ? { employmentTypeId: filter.employmentTypeId }
        : {}),
      ...(filter.workLocationId !== undefined
        ? { workLocationId: filter.workLocationId }
        : {}),
      ...(filter.reportsToId !== undefined
        ? { reportsToId: filter.reportsToId }
        : {}),
      ...(filter.hasUser !== undefined
        ? { userId: filter.hasUser ? { not: null } : null }
        : {}),
      ...(filter.joinedFrom || filter.joinedTo
        ? {
            dateOfJoining: {
              ...(filter.joinedFrom
                ? { gte: parseDateOnly(filter.joinedFrom) }
                : {}),
              ...(filter.joinedTo
                ? { lte: parseDateOnly(filter.joinedTo) }
                : {}),
            },
          }
        : {}),
      ...(filter.search
        ? {
            OR: [
              {
                employeeCode: { contains: filter.search, mode: "insensitive" },
              },
              { fullName: { contains: filter.search, mode: "insensitive" } },
              { workEmail: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: EMPLOYEE_INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { [filter.sortBy ?? "employeeCode"]: pagination.order ?? "asc" },
          { id: "asc" },
        ],
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items, total };
  }

  @TeamScoped()
  findOne(scope: TeamScope, id: number) {
    return this.prisma.employee.findFirst({
      where: teamWhere(scope, { id, deletedAt: null }),
      include: EMPLOYEE_INCLUDE,
    });
  }

  /** Organization-wide lookup for privileged lifecycle operations, whose own
   * permission (not a team scope) is the gate. */
  @OrgScoped()
  findOneInOrg(scope: OrgScope, id: number) {
    return this.prisma.employee.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: EMPLOYEE_INCLUDE,
    });
  }

  @OrgScoped()
  findByUserId(scope: OrgScope, userId: number) {
    return this.prisma.employee.findFirst({
      where: tenantWhere(scope, { userId, deletedAt: null }),
      include: EMPLOYEE_INCLUDE,
    });
  }

  /** Self-service onboarding completion only — the single column it is
   * allowed to touch, guarded to a forward-only transition so a second call
   * (a retried request) is a harmless no-op rather than an error. */
  @OrgScoped()
  async markOnboardingComplete(scope: OrgScope, employeeId: number) {
    await this.prisma.employee.updateMany({
      where: tenantWhere(scope, {
        id: employeeId,
        onboardingStatus: { not: "COMPLETE" },
        deletedAt: null,
      }),
      data: { onboardingStatus: "COMPLETE" },
    });
  }

  @OrgScoped()
  async findStatusHistory(
    scope: OrgScope,
    employeeId: number,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.EmployeeStatusHistoryWhereInput>(scope, {
      employeeId,
    });
    const [rows, total] = await Promise.all([
      this.prisma.employeeStatusHistory.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { id: pagination.order ?? "desc" },
        include: { changer: { select: { id: true, fullName: true } } },
      }),
      this.prisma.employeeStatusHistory.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id.toString(),
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        changeType: r.changeType,
        effectiveDate: formatDateOnly(r.effectiveDate),
        reason: r.reason,
        changedBy: r.changer,
        at: r.at,
      })),
      total,
    };
  }

  // ---- writes --------------------------------------------------------------

  /** Creates the employee, issues its code, records the initial status entry
   * and the audit row — all or nothing. */
  @OrgScoped()
  async create(
    scope: OrgScope,
    input: NewEmployee,
    actorId: number,
  ): Promise<EmployeeRow> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { teamDepartmentId } = await assertReferences(
          tx,
          scope.organizationId,
          input,
        );
        const employeeCode = await issueEmployeeCode(tx, scope.organizationId);
        const joined = parseDateOnly(input.dateOfJoining);

        const created = await tx.employee.create({
          data: {
            organizationId: scope.organizationId,
            employeeCode,
            fullName: input.fullName,
            workEmail: input.workEmail ?? null,
            phone: input.phone ?? null,
            teamId: input.teamId,
            departmentId: input.departmentId ?? teamDepartmentId,
            designationId: input.designationId,
            employmentTypeId: input.employmentTypeId,
            workLocationId: input.workLocationId ?? null,
            reportsToId: input.reportsToId ?? null,
            userId: input.userId ?? null,
            status: "ACTIVE",
            isActive: true,
            dateOfJoining: joined,
            createdBy: actorId,
            updatedBy: actorId,
          },
          include: EMPLOYEE_INCLUDE,
        });

        await tx.employeeStatusHistory.create({
          data: {
            organizationId: scope.organizationId,
            employeeId: created.id,
            fromStatus: null,
            toStatus: "ACTIVE",
            changeType: "transition",
            effectiveDate: joined,
            reason: "Employee created",
            changedBy: actorId,
          },
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: created.id,
          action: "create",
          after: auditSnapshot(created),
        });
        if (created.userId !== null) {
          await this.audit.write(tx, {
            entityType: ENTITY_TYPE,
            entityId: created.id,
            action: "link_user",
            after: { userId: created.userId },
            reason: "linked at creation",
          });
        }
        return created;
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  /**
   * Partial update guarded by the optimistic-lock `version`. Returns `null`
   * when the employee is not visible in `scope`. Nothing changed → the row is
   * returned as-is (no version bump, no audit entry).
   */
  @TeamScoped()
  async update(
    scope: TeamScope,
    id: number,
    patch: EmployeePatch,
    actorId: number,
  ): Promise<EmployeeRow | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockEmployee(tx, scope.organizationId, id))) return null;
        const before = await tx.employee.findFirst({
          where: teamWhere(scope, { id, deletedAt: null }),
          include: EMPLOYEE_INCLUDE,
        });
        if (!before) return null;
        if (before.version !== patch.version) {
          throw new VersionConflictException("Employee");
        }

        const changed: Record<string, unknown> = {};
        const set = <T>(key: string, next: T | undefined, current: T) => {
          if (next !== undefined && next !== current) changed[key] = next;
        };
        set("fullName", patch.fullName, before.fullName);
        set("workEmail", patch.workEmail, before.workEmail);
        set("phone", patch.phone, before.phone);
        set("teamId", patch.teamId, before.teamId);
        set("departmentId", patch.departmentId, before.departmentId);
        set("designationId", patch.designationId, before.designationId);
        set(
          "employmentTypeId",
          patch.employmentTypeId,
          before.employmentTypeId,
        );
        set("workLocationId", patch.workLocationId, before.workLocationId);
        set("reportsToId", patch.reportsToId, before.reportsToId);
        if (
          patch.dateOfJoining !== undefined &&
          patch.dateOfJoining !== formatDateOnly(before.dateOfJoining)
        ) {
          const joined = parseDateOnly(patch.dateOfJoining);
          if (before.dateOfExit && joined > before.dateOfExit) {
            throw new BusinessRuleViolationException(
              "Date of joining cannot be after the date of exit",
              "JOINING_AFTER_EXIT",
            );
          }
          changed.dateOfJoining = joined;
        }
        if (Object.keys(changed).length === 0) return before;

        await assertReferences(
          tx,
          scope.organizationId,
          {
            teamId: changed.teamId as number | undefined,
            departmentId: changed.departmentId as number | null | undefined,
            designationId: changed.designationId as number | undefined,
            employmentTypeId: changed.employmentTypeId as number | undefined,
            workLocationId: changed.workLocationId as number | null | undefined,
            reportsToId: changed.reportsToId as number | null | undefined,
          },
          id,
        );

        const after = await tx.employee.update({
          where: { id },
          data: {
            ...changed,
            version: { increment: 1 },
            updatedBy: actorId,
          } as Prisma.EmployeeUncheckedUpdateInput,
          include: EMPLOYEE_INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "update",
          before: auditSnapshot(before),
          after: auditSnapshot(after),
        });
        return after;
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  /** Unique-constraint races the service's checks could not see. */
  private asConflict(error: unknown): unknown {
    const violation = classifyDbError(error);
    if (violation?.kind === "unique") {
      const cols = violation.columns?.join(",") ?? violation.constraint ?? "";
      if (cols.includes("user_id")) {
        return new ResourceConflictException(
          "That user account is already linked to another employee",
        );
      }
      return new ResourceConflictException(
        "Another employee already has this work e-mail address",
      );
    }
    if (
      violation?.kind === "check" &&
      /employees_no_reporting_cycle|reporting line/.test(
        (error as { message?: string }).message ?? "",
      )
    ) {
      return new BusinessRuleViolationException(
        "That reporting line would make the employee (indirectly) report to themselves",
        "REPORTING_LINE_CYCLE",
      );
    }
    return error;
  }
}
