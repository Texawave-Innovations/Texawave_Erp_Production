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
  BusinessRuleConflictException,
  BusinessRuleViolationException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { shiftAssignmentScopeWhere } from "./shift-assignment-scope.js";

const ENTITY_TYPE = "shift_assignment";
const EXIT_STATUSES = ["RESIGNED", "TERMINATED"];

const INCLUDE = {
  shift: {
    select: {
      id: true,
      code: true,
      name: true,
      startTime: true,
      endTime: true,
      isOvernight: true,
      workingMinutes: true,
    },
  },
  employee: {
    select: { id: true, employeeCode: true, fullName: true, teamId: true },
  },
  team: { select: { id: true, name: true } },
} satisfies Prisma.ShiftAssignmentInclude;

type AssignmentRow = Prisma.ShiftAssignmentGetPayload<{
  include: typeof INCLUDE;
}>;

export interface ShiftAssignmentView {
  id: number;
  shift: AssignmentRow["shift"];
  employee: { id: number; employeeCode: string; fullName: string } | null;
  team: { id: number; name: string } | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  /** `false` = voided (entered in error). Voided rows are kept for history. */
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toView(row: AssignmentRow): ShiftAssignmentView {
  return {
    id: row.id,
    shift: row.shift,
    employee: row.employee
      ? {
          id: row.employee.id,
          employeeCode: row.employee.employeeCode,
          fullName: row.employee.fullName,
        }
      : null,
    team: row.team,
    effectiveFrom: formatDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
    reason: row.reason,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function snapshot(row: AssignmentRow) {
  return {
    shiftId: row.shift.id,
    employeeId: row.employee?.id ?? null,
    teamId: row.team?.id ?? null,
    effectiveFrom: formatDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
    isActive: row.isActive,
  };
}

export interface AssignmentFilter {
  employeeId?: number | undefined;
  teamId?: number | undefined;
  shiftId?: number | undefined;
  activeOn?: string | undefined;
  includeVoided?: boolean | undefined;
}

export interface NewAssignment {
  shiftId: number;
  employeeId?: number | undefined;
  teamId?: number | undefined;
  effectiveFrom: string;
  effectiveTo?: string | undefined;
  reason?: string | undefined;
}

export type ResolvedShift = ShiftAssignmentView & {
  /** Which kind of assignment supplied the shift. */
  source: "employee" | "team";
};

/** Only place `PrismaService` is called for shift assignments. Reads are
 * scoped by `shiftAssignmentScopeWhere()`; every write is one transaction with
 * its audit row, and overlap is enforced by a PostgreSQL exclusion constraint
 * (translated to a 409 here), not by a racy check-then-insert. */
@Injectable()
export class ShiftAssignmentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: AssignmentFilter,
    pagination: PaginationDto,
  ) {
    const day = filter.activeOn ? parseDateOnly(filter.activeOn) : undefined;
    const where: Prisma.ShiftAssignmentWhereInput = {
      AND: [
        shiftAssignmentScopeWhere(scope),
        {
          ...(filter.includeVoided ? {} : { isActive: true }),
          deletedAt: null,
          ...(filter.employeeId !== undefined
            ? { employeeId: filter.employeeId }
            : {}),
          ...(filter.teamId !== undefined ? { teamId: filter.teamId } : {}),
          ...(filter.shiftId !== undefined ? { shiftId: filter.shiftId } : {}),
          ...(day
            ? {
                effectiveFrom: { lte: day },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
              }
            : {}),
        },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.shiftAssignment.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { effectiveFrom: pagination.order ?? "desc" },
          { id: "desc" },
        ],
      }),
      this.prisma.shiftAssignment.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    const row = await this.prisma.shiftAssignment.findFirst({
      where: {
        AND: [shiftAssignmentScopeWhere(scope), { id, deletedAt: null }],
      },
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /** Whether the caller's read scope may see this employee at all. */
  @TeamScoped()
  async employeeVisible(
    scope: TeamScope,
    employeeId: number,
  ): Promise<boolean> {
    const found = await this.prisma.employee.findFirst({
      where: teamWhere(scope, { id: employeeId, deletedAt: null }),
      select: { id: true },
    });
    return found !== null;
  }

  @TeamScoped()
  async create(
    scope: TeamScope,
    input: NewAssignment,
    actorId: number,
  ): Promise<ShiftAssignmentView> {
    const from = parseDateOnly(input.effectiveFrom);
    const to = input.effectiveTo ? parseDateOnly(input.effectiveTo) : null;
    if ((input.employeeId === undefined) === (input.teamId === undefined)) {
      throw new BusinessRuleViolationException(
        "Give exactly one of employeeId or teamId",
        "ASSIGNMENT_TARGET_INVALID",
      );
    }
    if (to && to < from) {
      throw new BusinessRuleViolationException(
        "effectiveTo cannot be before effectiveFrom",
        "ASSIGNMENT_DATES_INVALID",
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const shift = await tx.shift.findFirst({
          where: {
            id: input.shiftId,
            organizationId: scope.organizationId,
            deletedAt: null,
            isActive: true,
          },
          select: { id: true },
        });
        if (!shift) {
          throw new BusinessRuleViolationException(
            `Shift ${input.shiftId} does not exist in this organization or is inactive`,
            "INVALID_SHIFT",
          );
        }

        if (input.employeeId !== undefined) {
          // Looked up THROUGH the caller's scope: an employee outside it is
          // indistinguishable from one that does not exist.
          const employee = await tx.employee.findFirst({
            where: teamWhere(scope, { id: input.employeeId, deletedAt: null }),
            select: { status: true, dateOfJoining: true },
          });
          if (!employee) {
            throw new BusinessRuleViolationException(
              `Employee ${input.employeeId} does not exist in this organization`,
              "INVALID_EMPLOYEE",
            );
          }
          if (EXIT_STATUSES.includes(employee.status)) {
            throw new BusinessRuleViolationException(
              "Cannot assign a shift to an employee who has left",
              "EMPLOYEE_HAS_LEFT",
            );
          }
          if (from < employee.dateOfJoining) {
            throw new BusinessRuleViolationException(
              "A shift cannot start before the employee's date of joining",
              "ASSIGNMENT_BEFORE_JOINING",
            );
          }
        } else if (input.teamId !== undefined) {
          const inScope =
            scope.level === "all" || scope.teamIds.includes(input.teamId);
          const team = inScope
            ? await tx.team.findFirst({
                where: {
                  id: input.teamId,
                  organizationId: scope.organizationId,
                  deletedAt: null,
                  isActive: true,
                },
                select: { id: true },
              })
            : null;
          if (!team) {
            throw new BusinessRuleViolationException(
              `Team ${input.teamId} does not exist in this organization or is not in your scope`,
              "INVALID_TEAM",
            );
          }
        }

        const created = await tx.shiftAssignment.create({
          data: {
            organizationId: scope.organizationId,
            shiftId: input.shiftId,
            employeeId: input.employeeId ?? null,
            teamId: input.teamId ?? null,
            effectiveFrom: from,
            effectiveTo: to,
            reason: input.reason ?? null,
            createdBy: actorId,
            updatedBy: actorId,
          },
          include: INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: created.id,
          action: "create",
          after: snapshot(created),
          reason: input.reason,
        });
        return toView(created);
      });
    } catch (error) {
      throw await this.explainOverlap(
        error,
        scope.organizationId,
        input,
        from,
        to,
      );
    }
  }

  /** Shortens an assignment (or gives an open-ended one an end date). It can
   * never be extended: that could silently collide with a later assignment,
   * and the history of "who worked what, when" must stay trustworthy. */
  @TeamScoped()
  async end(
    scope: TeamScope,
    id: number,
    input: { effectiveTo: string; reason?: string | undefined },
    actorId: number,
  ): Promise<ShiftAssignmentView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.shiftAssignment.findFirst({
        where: {
          AND: [shiftAssignmentScopeWhere(scope), { id, deletedAt: null }],
        },
        include: INCLUDE,
      });
      if (!before) return null;
      if (!before.isActive) {
        throw new BusinessRuleViolationException(
          "This assignment has been voided",
          "ASSIGNMENT_VOIDED",
        );
      }
      const newTo = parseDateOnly(input.effectiveTo);
      if (newTo < before.effectiveFrom) {
        throw new BusinessRuleViolationException(
          "effectiveTo cannot be before effectiveFrom",
          "ASSIGNMENT_DATES_INVALID",
        );
      }
      if (before.effectiveTo && newTo > before.effectiveTo) {
        throw new BusinessRuleViolationException(
          "An assignment can only be shortened, never extended — create a new one instead",
          "ASSIGNMENT_CANNOT_EXTEND",
        );
      }
      if (
        before.effectiveTo &&
        newTo.getTime() === before.effectiveTo.getTime()
      ) {
        return toView(before);
      }
      const after = await tx.shiftAssignment.update({
        where: { id },
        data: { effectiveTo: newTo, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "end",
        before: snapshot(before),
        after: snapshot(after),
        reason: input.reason,
      });
      return toView(after);
    });
  }

  /** Marks an assignment entered in error. Kept for history, ignored by the
   * overlap constraint and by every "current shift" lookup. Idempotent. */
  @TeamScoped()
  async voidOne(
    scope: TeamScope,
    id: number,
    reason: string,
    actorId: number,
  ): Promise<ShiftAssignmentView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.shiftAssignment.findFirst({
        where: {
          AND: [shiftAssignmentScopeWhere(scope), { id, deletedAt: null }],
        },
        include: INCLUDE,
      });
      if (!before) return null;
      if (!before.isActive) return toView(before);
      const after = await tx.shiftAssignment.update({
        where: { id },
        data: { isActive: false, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "void",
        before: snapshot(before),
        after: snapshot(after),
        reason,
      });
      return toView(after);
    });
  }

  /**
   * The shift an employee works on a date. PRECEDENCE (an unapproved default,
   * to be confirmed — see the readiness report): an assignment made to the
   * employee wins; otherwise the default assignment of the employee's CURRENT
   * team applies. Team membership history is not tracked, so a past date is
   * resolved against the team the employee is in today.
   */
  @OrgScoped()
  async resolve(
    scope: OrgScope,
    employeeId: number,
    date: Date,
  ): Promise<ResolvedShift | null> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      select: { id: true, teamId: true },
    });
    if (!employee) return null;

    const covering = {
      organizationId: scope.organizationId,
      isActive: true,
      deletedAt: null,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    } satisfies Prisma.ShiftAssignmentWhereInput;

    const personal = await this.prisma.shiftAssignment.findFirst({
      where: { ...covering, employeeId: employee.id },
      include: INCLUDE,
    });
    if (personal) return { ...toView(personal), source: "employee" };

    const team = await this.prisma.shiftAssignment.findFirst({
      where: { ...covering, teamId: employee.teamId },
      include: INCLUDE,
    });
    return team ? { ...toView(team), source: "team" } : null;
  }

  private async lock(
    tx: Prisma.TransactionClient,
    organizationId: number,
    id: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM hr.shift_assignments
       WHERE id = ${id} AND organization_id = ${organizationId} FOR UPDATE`;
  }

  /** Turns the exclusion-constraint failure into a 409 that names the
   * assignment in the way; anything else is rethrown untouched. */
  private async explainOverlap(
    error: unknown,
    organizationId: number,
    input: NewAssignment,
    from: Date,
    to: Date | null,
  ): Promise<unknown> {
    if (classifyDbError(error)?.kind !== "exclusion") return error;
    const clash = await this.prisma.shiftAssignment.findFirst({
      where: {
        organizationId,
        isActive: true,
        ...(input.employeeId !== undefined
          ? { employeeId: input.employeeId }
          : { teamId: input.teamId as number }),
        ...(to ? { effectiveFrom: { lte: to } } : {}),
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      orderBy: { effectiveFrom: "asc" },
    });
    const detail = clash
      ? ` (assignment #${clash.id}: ${formatDateOnly(clash.effectiveFrom)} to ${clash.effectiveTo ? formatDateOnly(clash.effectiveTo) : "open-ended"})`
      : "";
    return new BusinessRuleConflictException(
      `Overlaps an existing shift assignment${detail} — end or void it first`,
      "SHIFT_ASSIGNMENT_OVERLAP",
    );
  }
}
