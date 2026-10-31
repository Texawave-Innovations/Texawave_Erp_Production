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
  BusinessException,
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
import {
  assertReviewable,
  type OnboardingReviewStatus,
  type ReviewDecision,
  reviewOutcome,
} from "./onboarding-review.policy.js";

const ENTITY_TYPE = "employee";

export interface EmployeeFilter {
  search?: string | undefined;
  status?: EmployeeStatus | undefined;
  onboardingStatus?: string | undefined;
  onboardingReviewStatus?: OnboardingReviewStatus | undefined;
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
  probationEndDate?: string | undefined;
  confirmationDate?: string | undefined;
  referredBy?: string | undefined;
  workDomain?: string | undefined;
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
  probationEndDate?: string | null | undefined;
  confirmationDate?: string | null | undefined;
  referredBy?: string | null | undefined;
  workDomain?: string | null | undefined;
}

/** One row of a bulk create: its 1-based position in the source file. */
export interface BatchRow {
  row: number;
  input: NewEmployee;
}

export interface BatchResult {
  created: Array<{ row: number; id: number; employeeCode: string }>;
  errors: Array<{ row: number; message: string; errorCode?: string }>;
}

export interface EmployeeStats {
  total: number;
  byStatus: Record<string, number>;
  onboarding: {
    profileIncomplete: number;
    pendingReview: number;
    changesRequested: number;
  };
  withoutLogin: number;
  joinedThisMonth: number;
  byTeam: Array<{ teamId: number; teamName: string; count: number }>;
}

/** Thrown inside a batch transaction to roll it back on purpose. */
class RollbackBatch extends Error {}

/** Probation and confirmation are on or after joining (CHECKs mirror this). */
function assertDatesAfterJoining(
  joined: Date,
  probationEnd: Date | null,
  confirmation: Date | null,
): void {
  if (probationEnd && probationEnd < joined) {
    throw new BusinessRuleViolationException(
      "Probation end date cannot be before the date of joining",
      "PROBATION_BEFORE_JOINING",
    );
  }
  if (confirmation && confirmation < joined) {
    throw new BusinessRuleViolationException(
      "Confirmation date cannot be before the date of joining",
      "CONFIRMATION_BEFORE_JOINING",
    );
  }
}

const dateOrNull = (value: string | null | undefined): Date | null =>
  value ? parseDateOnly(value) : null;

function filterWhere(filter: EmployeeFilter): Prisma.EmployeeWhereInput {
  return {
    deletedAt: null,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.onboardingStatus
      ? { onboardingStatus: filter.onboardingStatus }
      : {}),
    ...(filter.onboardingReviewStatus
      ? { onboardingReviewStatus: filter.onboardingReviewStatus }
      : {}),
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
            ...(filter.joinedTo ? { lte: parseDateOnly(filter.joinedTo) } : {}),
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
  };
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
    const where = teamWhere(scope, filterWhere(filter));
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

  /** Every matching row in scope, for the CSV export. `max + 1` rows are
   * read so the caller can tell "exactly max" from "more than max". */
  @TeamScoped()
  findForExport(scope: TeamScope, filter: EmployeeFilter, max: number) {
    return this.prisma.employee.findMany({
      where: teamWhere(scope, filterWhere(filter)),
      include: EMPLOYEE_INCLUDE,
      take: max + 1,
      orderBy: [{ [filter.sortBy ?? "employeeCode"]: "asc" }, { id: "asc" }],
    });
  }

  /** Directory counts for the caller's scope (the list page's stats cards). */
  @TeamScoped()
  async stats(scope: TeamScope, today: Date): Promise<EmployeeStats> {
    const where = teamWhere(scope, { deletedAt: null });
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const [
      byStatus,
      byOnboarding,
      byReview,
      withoutLogin,
      joinedThisMonth,
      byTeam,
    ] = await Promise.all([
      this.prisma.employee.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.employee.groupBy({
        by: ["onboardingStatus"],
        where,
        _count: { _all: true },
      }),
      this.prisma.employee.groupBy({
        by: ["onboardingReviewStatus"],
        where,
        _count: { _all: true },
      }),
      this.prisma.employee.count({ where: { AND: [where, { userId: null }] } }),
      this.prisma.employee.count({
        where: { AND: [where, { dateOfJoining: { gte: monthStart } }] },
      }),
      this.prisma.employee.groupBy({
        by: ["teamId"],
        where,
        _count: { _all: true },
      }),
    ]);

    const teams = await this.prisma.team.findMany({
      where: {
        organizationId: scope.organizationId,
        id: { in: byTeam.map((t) => t.teamId) },
      },
      select: { id: true, name: true },
    });
    const teamName = new Map(teams.map((t) => [t.id, t.name]));
    const count = (
      rows: Array<{ _count: { _all: number } } & Record<string, unknown>>,
      key: string,
      value: string,
    ) => rows.find((r) => r[key] === value)?._count._all ?? 0;

    return {
      total: byStatus.reduce((sum, r) => sum + r._count._all, 0),
      byStatus: Object.fromEntries(
        byStatus.map((r) => [r.status, r._count._all]),
      ),
      onboarding: {
        profileIncomplete: count(
          byOnboarding,
          "onboardingStatus",
          "PENDING_ACTIVATION",
        ),
        pendingReview: count(
          byReview,
          "onboardingReviewStatus",
          "PENDING_REVIEW",
        ),
        changesRequested: count(
          byReview,
          "onboardingReviewStatus",
          "CHANGES_REQUESTED",
        ),
      },
      withoutLogin,
      joinedThisMonth,
      byTeam: byTeam
        .map((t) => ({
          teamId: t.teamId,
          teamName: teamName.get(t.teamId) ?? "",
          count: t._count._all,
        }))
        .sort((a, b) => a.teamName.localeCompare(b.teamName)),
    };
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

  /** Name → id maps of the organization's active masters, and the employee
   * codes, e-mails and phone digits already taken — what a CSV import needs
   * to resolve and pre-check its rows. Reference validity is still enforced
   * row by row by `assertReferences()` inside the import transaction. */
  @OrgScoped()
  async importLookups(scope: OrgScope) {
    const live = {
      organizationId: scope.organizationId,
      deletedAt: null,
      isActive: true,
    };
    const named = { select: { id: true, name: true } } as const;
    const [
      teams,
      departments,
      designations,
      employmentTypes,
      locations,
      staff,
    ] = await Promise.all([
      this.prisma.team.findMany({ where: live, ...named }),
      this.prisma.department.findMany({ where: live, ...named }),
      this.prisma.designation.findMany({ where: live, ...named }),
      this.prisma.employmentType.findMany({ where: live, ...named }),
      this.prisma.workLocation.findMany({ where: live, ...named }),
      this.prisma.employee.findMany({
        where: { organizationId: scope.organizationId, deletedAt: null },
        select: {
          id: true,
          employeeCode: true,
          workEmail: true,
          phone: true,
        },
      }),
    ]);
    const byName = (rows: Array<{ id: number; name: string }>) =>
      new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.id]));
    return {
      teams: byName(teams),
      departments: byName(departments),
      designations: byName(designations),
      employmentTypes: byName(employmentTypes),
      workLocations: byName(locations),
      employeeIdByCode: new Map(
        staff.map((e) => [e.employeeCode.toUpperCase(), e.id]),
      ),
      takenEmails: new Set(
        staff.flatMap((e) => (e.workEmail ? [e.workEmail.toLowerCase()] : [])),
      ),
      takenPhones: new Set(
        staff.flatMap((e) => (e.phone ? [e.phone.replace(/\D/g, "")] : [])),
      ),
    };
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

  // ---- onboarding ------------------------------------------------------------

  /** Self-service submission: completes the wizard and queues the profile for
   * HR review, in one step. Guarded to a forward-only transition so a second
   * call (a retried request) is a harmless no-op rather than an error. */
  @OrgScoped()
  async markOnboardingComplete(scope: OrgScope, employeeId: number) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.employee.updateMany({
        where: tenantWhere(scope, {
          id: employeeId,
          onboardingStatus: { not: "COMPLETE" },
          deletedAt: null,
        }),
        data: {
          onboardingStatus: "COMPLETE",
          onboardingReviewStatus: "PENDING_REVIEW",
          onboardingSubmittedAt: new Date(),
        },
      });
      if (count > 0) {
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: employeeId,
          action: "submit_onboarding",
          after: { onboardingReviewStatus: "PENDING_REVIEW" },
        });
      }
    });
  }

  /**
   * HR decision on a submitted profile. Returns `null` when the employee is
   * not visible in `scope`. Refuses a decision on one's own profile and —
   * unless `force` — a profile that is not waiting for review. `force` is an
   * explicit HR override (requested and confirmed by the user) that skips
   * that check, so an approve can go through on a profile that was never
   * submitted; it changes nothing else about the decision.
   */
  @TeamScoped()
  async decideOnboarding(
    scope: TeamScope,
    id: number,
    decision: ReviewDecision,
    note: string | null,
    actorId: number,
    force = false,
  ): Promise<EmployeeRow | null> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockEmployee(tx, scope.organizationId, id))) return null;
      const before = await tx.employee.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }),
        include: EMPLOYEE_INCLUDE,
      });
      if (!before) return null;
      if (before.userId !== null && before.userId === actorId) {
        throw new BusinessRuleViolationException(
          "You cannot review your own onboarding profile",
          "SELF_REVIEW_FORBIDDEN",
        );
      }
      if (!force) assertReviewable(before.onboardingReviewStatus);

      const outcome = reviewOutcome(decision);
      // A force-approved profile was never submitted, so it never went
      // through the submit step that normally flips onboardingStatus to
      // COMPLETE — without this, landingPathAfterLogin keeps sending the
      // employee back into the wizard despite being Approved.
      const forceApproved = force && decision === "approve";
      const after = await tx.employee.update({
        where: { id },
        data: {
          onboardingReviewStatus: outcome.reviewStatus,
          ...(outcome.onboardingStatus
            ? { onboardingStatus: outcome.onboardingStatus }
            : forceApproved
              ? { onboardingStatus: "COMPLETE" }
              : {}),
          onboardingReviewedAt: new Date(),
          onboardingReviewedBy: actorId,
          onboardingReviewNote: note,
          version: { increment: 1 },
          updatedBy: actorId,
        },
        include: EMPLOYEE_INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action:
          decision === "approve"
            ? "approve_onboarding"
            : "send_back_onboarding",
        before: { onboardingReviewStatus: before.onboardingReviewStatus },
        after: { onboardingReviewStatus: after.onboardingReviewStatus },
        ...(note ? { reason: note } : {}),
      });
      return after;
    });
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
      return await this.prisma.$transaction((tx) =>
        this.insert(tx, scope, input, actorId),
      );
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  /**
   * Bulk create (CSV import) in ONE transaction. Every row is attempted so the
   * report lists every problem; business-rule failures are collected per row.
   * Nothing is committed when any row failed or `dryRun` is set — the whole
   * transaction is rolled back, including the employee codes it issued.
   * Duplicate e-mails/phones must be pre-checked by the caller: a database
   * unique violation aborts the transaction and is reported for the batch.
   */
  @OrgScoped()
  async createBatch(
    scope: OrgScope,
    rows: BatchRow[],
    actorId: number,
    dryRun: boolean,
  ): Promise<BatchResult> {
    const result: BatchResult = { created: [], errors: [] };
    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const { row, input } of rows) {
            try {
              const created = await this.insert(tx, scope, input, actorId);
              result.created.push({
                row,
                id: created.id,
                employeeCode: created.employeeCode,
              });
            } catch (error) {
              if (!(error instanceof BusinessException)) throw error;
              result.errors.push({
                row,
                message: error.message,
                ...(error.errorCode ? { errorCode: error.errorCode } : {}),
              });
            }
          }
          if (dryRun || result.errors.length > 0) throw new RollbackBatch();
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      if (!(error instanceof RollbackBatch)) throw this.asConflict(error);
      if (result.errors.length > 0) result.created = [];
    }
    return result;
  }

  private async insert(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    input: NewEmployee,
    actorId: number,
  ): Promise<EmployeeRow> {
    const joined = parseDateOnly(input.dateOfJoining);
    const probationEnd = dateOrNull(input.probationEndDate);
    const confirmation = dateOrNull(input.confirmationDate);
    assertDatesAfterJoining(joined, probationEnd, confirmation);

    const { teamDepartmentId } = await assertReferences(
      tx,
      scope.organizationId,
      input,
    );
    const employeeCode = await issueEmployeeCode(tx, scope.organizationId);

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
        probationEndDate: probationEnd,
        confirmationDate: confirmation,
        referredBy: input.referredBy ?? null,
        workDomain: input.workDomain ?? null,
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
        const setDate = (
          key: "dateOfJoining" | "probationEndDate" | "confirmationDate",
          next: string | null | undefined,
          current: Date | null,
        ) => {
          if (next === undefined) return;
          const currentText = current ? formatDateOnly(current) : null;
          if (next !== currentText) changed[key] = dateOrNull(next);
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
        set("referredBy", patch.referredBy, before.referredBy);
        set("workDomain", patch.workDomain, before.workDomain);
        setDate("dateOfJoining", patch.dateOfJoining, before.dateOfJoining);
        setDate(
          "probationEndDate",
          patch.probationEndDate,
          before.probationEndDate,
        );
        setDate(
          "confirmationDate",
          patch.confirmationDate,
          before.confirmationDate,
        );
        if (Object.keys(changed).length === 0) return before;

        const joined =
          (changed.dateOfJoining as Date | undefined) ?? before.dateOfJoining;
        if (before.dateOfExit && joined > before.dateOfExit) {
          throw new BusinessRuleViolationException(
            "Date of joining cannot be after the date of exit",
            "JOINING_AFTER_EXIT",
          );
        }
        assertDatesAfterJoining(
          joined,
          "probationEndDate" in changed
            ? (changed.probationEndDate as Date | null)
            : before.probationEndDate,
          "confirmationDate" in changed
            ? (changed.confirmationDate as Date | null)
            : before.confirmationDate,
        );

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
      const where = [
        ...(violation.columns ?? []),
        violation.constraint ?? "",
        (error as { message?: string }).message ?? "",
      ].join(",");
      if (where.includes("user_id")) {
        return new ResourceConflictException(
          "That user account is already linked to another employee",
        );
      }
      if (where.includes("phone")) {
        return new ResourceConflictException(
          "Another employee already has this phone number",
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

  /**
   * True hard delete — permanently removes the row and, so the action always
   * succeeds from the UI rather than failing with a foreign-key conflict,
   * cascades through everything that points at this employee first:
   *
   * - The employee's own record/profile (status history, onboarding detail,
   *   documents, etc.) is deleted outright — it exists only to describe this
   *   one employee.
   * - Real business records that belong to this employee alone (leave,
   *   attendance, payroll, tasks assigned to them, tickets they raised, their
   *   project membership and time entries, letters, loans, …) are deleted
   *   outright too — there is no other employee to reassign them to.
   * - Anything that is merely *associated* with this employee but is really
   *   someone else's record, or isn't about one specific person, is detached
   *   (set to NULL) instead of deleted: a subordinate's `reportsToId`, a task
   *   or ticket comment this employee merely authored on someone else's
   *   behalf, a project's client-handling contact.
   *
   * Deliberately irreversible and broad — this is what "the delete button
   * must always work" means. Deactivating via the status lifecycle remains
   * the safe, reversible way to remove someone from active use.
   */
  async delete(scope: OrgScope, id: number): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.employee.findFirst({
          where: tenantWhere(scope, { id, deletedAt: null }),
          include: EMPLOYEE_INCLUDE,
        });
        if (!before) return false;
        const where = { employeeId: id };

        // Detach — these are someone else's record or a shared one; this
        // employee's relation to it is incidental, not its reason to exist.
        await tx.employee.updateMany({
          where: { reportsToId: id },
          data: { reportsToId: null },
        });
        await tx.task.updateMany({
          where: { createdByEmployeeId: id },
          data: { createdByEmployeeId: null },
        });
        await tx.ticketComment.updateMany({
          where: { authorEmployeeId: id },
          data: { authorEmployeeId: null },
        });
        await tx.project.updateMany({
          where: { clientHandlingPersonId: id },
          data: { clientHandlingPersonId: null },
        });

        // Delete — this employee's own record, or a record that exists only
        // because of them (no one else to reassign it to).
        await tx.employeeStatusHistory.deleteMany({ where });
        await tx.employeeLocationPrivilege.deleteMany({ where });
        await tx.employeeProfile.deleteMany({ where });
        await tx.employeeSensitiveInfo.deleteMany({ where });
        await tx.employeePersonalDetail.deleteMany({ where });
        await tx.employeeBankDetail.deleteMany({ where });
        await tx.employeeFamilyMember.deleteMany({ where });
        await tx.employeeExperience.deleteMany({ where });
        await tx.employeeDocument.deleteMany({ where });
        await tx.employeeAddress.deleteMany({ where });
        await tx.employeeGovernmentId.deleteMany({ where });
        await tx.shiftAssignment.deleteMany({ where });
        await tx.leaveRequest.deleteMany({ where });
        await tx.leaveEntitlement.deleteMany({ where });
        await tx.expenseClaim.deleteMany({ where });
        await tx.exitRequest.deleteMany({ where });
        await tx.attendanceRecord.deleteMany({ where });
        await tx.attendanceCorrection.deleteMany({ where });
        await tx.attendanceMonthLock.deleteMany({ where });
        // Comments on a ticket this employee raised block deleting the
        // ticket itself (ticket_comments.ticket_id is ON DELETE RESTRICT).
        await tx.ticketComment.deleteMany({
          where: { ticket: { employeeId: id } },
        });
        await tx.ticket.deleteMany({ where });
        await tx.revisionLetter.deleteMany({ where });
        await tx.promotionLetter.deleteMany({ where });
        // employee_salary_components cascades from employee_salary (schema).
        await tx.employeeSalary.deleteMany({ where });
        await tx.employeePfProfile.deleteMany({ where });
        await tx.employeeEsiProfile.deleteMany({ where });
        await tx.employeeLoan.deleteMany({ where });
        await tx.employeeBonus.deleteMany({ where });
        await tx.payrollEntry.deleteMany({ where });
        await tx.payslip.deleteMany({ where });
        await tx.payrollPayment.deleteMany({ where });
        await tx.pfContribution.deleteMany({ where });
        await tx.esiContribution.deleteMany({ where });
        await tx.employeeTaxDeclaration.deleteMany({ where });
        await tx.projectMember.deleteMany({ where });
        await tx.projectTimeEntry.deleteMany({ where });
        await tx.projectPointsLedger.deleteMany({ where });
        await tx.task.deleteMany({ where: { assigneeId: id } });
        await tx.projectTask.deleteMany({ where: { assignedToId: id } });
        await tx.employee.delete({ where: { id } });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "delete",
          before: auditSnapshot(before),
          after: null,
        });
        return true;
      });
    } catch (error) {
      const violation = classifyDbError(error);
      if (violation?.kind === "foreign_key") {
        throw new ResourceConflictException(
          "This employee cannot be deleted because they still have linked records (attendance, payroll, tasks, or similar). Deactivate them instead, or remove those records first.",
        );
      }
      throw this.asConflict(error);
    }
  }
}
