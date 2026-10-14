import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
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
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  AlreadyCheckedInException,
  AttendanceMonthLockedException,
  NotCheckedInException,
} from "./attendance.exceptions.js";
import type { ManualAttendanceEditDto } from "./dto/attendance.dto.js";
import {
  overlaps,
  type ImportRowError,
} from "./import-export/attendance-csv.js";
import {
  firstDayOf,
  LOCKED_STATUSES,
  monthOf,
} from "./month-locks/month-lock.rules.js";
import type { StoredStatus } from "./services/attendance-calculation.service.js";
import {
  planCorrection,
  type CorrectionPlan,
} from "./services/attendance-correction-planner.js";
import type { StoredDay } from "./services/attendance-day-view.service.js";

const ENTITY_TYPE = "attendance_record";
const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const SESSION_SELECT = {
  id: true,
  checkInAt: true,
  checkOutAt: true,
  source: true,
} satisfies Prisma.AttendanceSessionSelect;

const RECORD_INCLUDE = {
  sessions: { select: SESSION_SELECT, orderBy: { checkInAt: "asc" } },
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
      workLocationId: true,
    },
  },
} satisfies Prisma.AttendanceRecordInclude;

export type AttendanceRecordRow = Prisma.AttendanceRecordGetPayload<{
  include: typeof RECORD_INCLUDE;
}>;

export interface AttendanceFilter {
  from: string;
  to: string;
  employeeId?: number | undefined;
  status?: StoredStatus | undefined;
}

/** One validated punch pair from an import, already matched to an employee. */
export interface ImportPunch {
  row: number;
  employeeId: number;
  date: string;
  checkInAt: Date;
  checkOutAt: Date;
}

export interface ImportBatchResult {
  created: number;
  duplicates: number;
  errors: ImportRowError[];
}

/** Thrown inside the import transaction to roll it back on a dry run or when
 * any row failed; never escapes the repository. */
class RollbackImport extends Error {}

export function toStoredDay(row: AttendanceRecordRow): StoredDay {
  return {
    recordId: row.id,
    employeeId: row.employeeId,
    attendanceDate: formatDateOnly(row.attendanceDate),
    storedStatus: (row.status as StoredStatus | null) ?? null,
    sessions: row.sessions.map((s) => ({
      id: s.id,
      checkInAt: s.checkInAt,
      checkOutAt: s.checkOutAt,
      source: s.source,
    })),
  };
}

/** Audit snapshot of a day: its stored status and its punches, nothing else. */
function snapshot(row: {
  status: string | null;
  sessions: { checkInAt: Date; checkOutAt: Date | null; source: string }[];
}) {
  return {
    status: row.status,
    sessions: row.sessions.map((s) => ({
      checkInAt: s.checkInAt.toISOString(),
      checkOutAt: s.checkOutAt ? s.checkOutAt.toISOString() : null,
      source: s.source,
    })),
  };
}

/** Only place PrismaService is used for attendance records and sessions.
 * Reads go through `teamWhere()` / `tenantWhere()`. Every punch change runs in
 * a transaction under a per-employee advisory lock, so two concurrent punches
 * for one employee are serialised (the DB partial unique index is the backstop
 * for "one open session per day"). */
@Injectable()
export class AttendanceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  // ---- self-service punches ----------------------------------------------

  @OrgScoped()
  async checkIn(
    scope: OrgScope,
    employeeId: number,
    attendanceDate: string,
    now: Date,
    userId: number,
  ): Promise<{ recordId: number; sessionId: number }> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockEmployee(tx, scope, employeeId);
      if (await this.findOpenSession(tx, scope, employeeId)) {
        throw new AlreadyCheckedInException();
      }
      const record = await tx.attendanceRecord.upsert({
        where: {
          organizationId_employeeId_attendanceDate: {
            organizationId: scope.organizationId,
            employeeId,
            attendanceDate: parseDateOnly(attendanceDate),
          },
        },
        create: {
          organizationId: scope.organizationId,
          employeeId,
          attendanceDate: parseDateOnly(attendanceDate),
          createdBy: userId,
          updatedBy: userId,
        },
        update: {},
        select: { id: true },
      });
      const session = await tx.attendanceSession.create({
        data: {
          attendanceRecordId: record.id,
          checkInAt: now,
          source: "SELF",
          createdBy: userId,
          updatedBy: userId,
        },
        select: { id: true },
      });
      return { recordId: record.id, sessionId: session.id };
    });
  }

  @OrgScoped()
  async checkOut(
    scope: OrgScope,
    employeeId: number,
    now: Date,
    userId: number,
  ): Promise<{ recordId: number; sessionId: number }> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockEmployee(tx, scope, employeeId);
      const open = await this.findOpenSession(tx, scope, employeeId);
      if (!open) throw new NotCheckedInException();
      if (now.getTime() <= open.checkInAt.getTime()) {
        throw new BusinessRuleViolationException(
          "Check-out must be after check-in",
          "CHECK_OUT_BEFORE_CHECK_IN",
        );
      }
      // Conditional on checkOutAt IS NULL: a concurrent checkout that won the
      // race leaves count 0 here, and we refuse instead of overwriting it.
      const { count } = await tx.attendanceSession.updateMany({
        where: { id: open.id, checkOutAt: null },
        data: { checkOutAt: now, updatedBy: userId },
      });
      if (count !== 1) throw new NotCheckedInException();
      return { recordId: open.recordId, sessionId: open.id };
    });
  }

  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    filter: AttendanceFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.AttendanceRecordWhereInput>(scope, {
      ...this.filterWhere({ ...filter, employeeId }),
    });
    return this.page(where, pagination);
  }

  // ---- HR / manager view (own · team · all) ------------------------------

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: AttendanceFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(scope, this.filterWhere(filter), VIA_EMPLOYEE);
    return this.page(where as Prisma.AttendanceRecordWhereInput, pagination);
  }

  @TeamScoped()
  async findOne(
    scope: TeamScope,
    id: number,
  ): Promise<AttendanceRecordRow | null> {
    return this.prisma.attendanceRecord.findFirst({
      where: teamWhere(scope, { id, deletedAt: null }, VIA_EMPLOYEE),
      include: RECORD_INCLUDE,
    });
  }

  // ---- HR manual edit ------------------------------------------------------

  /** Replaces the day's punches and/or stored status, in one transaction, with
   * the complete before-state of every changed row written to the audit trail.
   * The caller has already confirmed the record is inside its scope. */
  @OrgScoped()
  async manualEdit(
    scope: OrgScope,
    recordId: number,
    edit: ManualAttendanceEditDto,
    sessions: { checkInAt: Date; checkOutAt: Date | null }[] | undefined,
    userId: number,
  ): Promise<AttendanceRecordRow> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.attendanceRecord.findFirst({
        where: {
          id: recordId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        include: RECORD_INCLUDE,
      });
      if (!before)
        throw new Error(
          `attendance record ${recordId} vanished inside the edit transaction`,
        );
      await this.lockEmployee(tx, scope, before.employeeId);
      await this.assertMonthOpen(
        tx,
        scope,
        before.employeeId,
        formatDateOnly(before.attendanceDate),
      );

      if (sessions !== undefined) {
        const otherOpen = await tx.attendanceSession.findFirst({
          where: {
            checkOutAt: null,
            attendanceRecordId: { not: recordId },
            record: {
              organizationId: scope.organizationId,
              employeeId: before.employeeId,
            },
          },
          select: { id: true },
        });
        if (otherOpen && sessions.some((s) => s.checkOutAt === null)) {
          throw new BusinessRuleConflictException(
            "The employee already has an open session on another day",
            "OPEN_SESSION_EXISTS",
          );
        }
        await tx.attendanceSession.deleteMany({
          where: { attendanceRecordId: recordId },
        });
        if (sessions.length > 0) {
          await tx.attendanceSession.createMany({
            data: sessions.map((s) => ({
              attendanceRecordId: recordId,
              checkInAt: s.checkInAt,
              checkOutAt: s.checkOutAt,
              source: "HR",
              createdBy: userId,
              updatedBy: userId,
            })),
          });
        }
      }

      const statusChanged = edit.status !== undefined;
      await tx.attendanceRecord.update({
        where: { id: recordId },
        data: {
          ...(statusChanged ? { status: edit.status ?? null } : {}),
          updatedBy: userId,
        },
      });

      const after = await tx.attendanceRecord.findUniqueOrThrow({
        where: { id: recordId },
        include: RECORD_INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: recordId,
        action: "manual_edit",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  // ---- correction application (called inside the approval transaction) -----

  /** Applies an approved correction's plan to the day's punches, inside the
   * caller's transaction. Returns the record id and the plan that was applied
   * so the caller can audit it. Throws if the plan is not applicable. */
  @OrgScoped()
  async applyCorrection(
    scope: OrgScope,
    tx: Prisma.TransactionClient,
    input: {
      employeeId: number;
      attendanceDate: string;
      correctionType: string;
      requestedCheckInAt: Date | null;
      requestedCheckOutAt: Date | null;
    },
    userId: number,
  ): Promise<{
    recordId: number;
    plan: CorrectionPlan;
    before: unknown;
    after: unknown;
  }> {
    await this.lockEmployee(tx, scope, input.employeeId);
    await this.assertMonthOpen(
      tx,
      scope,
      input.employeeId,
      input.attendanceDate,
    );
    const record = await tx.attendanceRecord.upsert({
      where: {
        organizationId_employeeId_attendanceDate: {
          organizationId: scope.organizationId,
          employeeId: input.employeeId,
          attendanceDate: parseDateOnly(input.attendanceDate),
        },
      },
      create: {
        organizationId: scope.organizationId,
        employeeId: input.employeeId,
        attendanceDate: parseDateOnly(input.attendanceDate),
        createdBy: userId,
        updatedBy: userId,
      },
      update: {},
      select: { id: true },
    });
    const existing = await tx.attendanceSession.findMany({
      where: { attendanceRecordId: record.id },
      select: SESSION_SELECT,
      orderBy: { checkInAt: "asc" },
    });
    const plan = planCorrection(
      {
        attendanceDate: input.attendanceDate,
        correctionType: input.correctionType,
        requestedCheckInAt: input.requestedCheckInAt,
        requestedCheckOutAt: input.requestedCheckOutAt,
      },
      existing,
    );

    if (plan.creates.some((s) => s.checkOutAt === null)) {
      const otherOpen = await tx.attendanceSession.findFirst({
        where: {
          checkOutAt: null,
          attendanceRecordId: { not: record.id },
          record: {
            organizationId: scope.organizationId,
            employeeId: input.employeeId,
          },
        },
        select: { id: true },
      });
      if (otherOpen) {
        throw new BusinessRuleConflictException(
          "The employee already has an open session on another day",
          "OPEN_SESSION_EXISTS",
        );
      }
    }

    for (const update of plan.updates) {
      await tx.attendanceSession.update({
        where: { id: update.id },
        data: {
          ...(update.checkInAt ? { checkInAt: update.checkInAt } : {}),
          ...(update.checkOutAt ? { checkOutAt: update.checkOutAt } : {}),
          source: "CORRECTION",
          updatedBy: userId,
        },
      });
    }
    if (plan.creates.length > 0) {
      await tx.attendanceSession.createMany({
        data: plan.creates.map((s) => ({
          attendanceRecordId: record.id,
          checkInAt: s.checkInAt,
          checkOutAt: s.checkOutAt,
          source: "CORRECTION",
          createdBy: userId,
          updatedBy: userId,
        })),
      });
    }

    const after = await tx.attendanceRecord.findUniqueOrThrow({
      where: { id: record.id },
      include: RECORD_INCLUDE,
    });
    return {
      recordId: record.id,
      plan,
      before: {
        sessions: existing.map((s) => ({
          checkInAt: s.checkInAt.toISOString(),
          checkOutAt: s.checkOutAt?.toISOString() ?? null,
        })),
      },
      after: snapshot(after),
    };
  }

  // ---- punch import -----------------------------------------------------------

  /** Employees matching the codes, inside the caller's team scope. A code
   * outside the scope is simply not returned (reported as not found). */
  @TeamScoped()
  async findImportEmployees(scope: TeamScope, codes: readonly string[]) {
    if (codes.length === 0) return [];
    return this.prisma.employee.findMany({
      where: teamWhere(
        scope,
        { deletedAt: null, employeeCode: { in: [...codes] } },
        { teamField: "teamId", ownerField: "userId" },
      ) as Prisma.EmployeeWhereInput,
      select: {
        id: true,
        employeeCode: true,
        userId: true,
        dateOfJoining: true,
        dateOfExit: true,
      },
    });
  }

  /**
   * Adds imported punch pairs, all or nothing, in one transaction. Per
   * employee (in id order, so two imports cannot deadlock) it takes the punch
   * lock, refuses a submitted/approved month, skips a pair identical to one
   * already stored (re-importing a file is harmless) and refuses one that
   * overlaps a stored session. If any row fails, or on a dry run, everything
   * is rolled back and only the report is returned.
   */
  @OrgScoped()
  async importBatch(
    scope: OrgScope,
    punches: readonly ImportPunch[],
    userId: number,
    dryRun: boolean,
  ): Promise<ImportBatchResult> {
    const result: ImportBatchResult = { created: 0, duplicates: 0, errors: [] };
    const byEmployee = new Map<number, ImportPunch[]>();
    for (const p of punches) {
      const list = byEmployee.get(p.employeeId);
      if (list) list.push(p);
      else byEmployee.set(p.employeeId, [p]);
    }
    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const employeeId of [...byEmployee.keys()].sort(
            (a, b) => a - b,
          )) {
            await this.lockEmployee(tx, scope, employeeId);
            const byDate = new Map<string, ImportPunch[]>();
            for (const p of byEmployee.get(employeeId)!) {
              const list = byDate.get(p.date);
              if (list) list.push(p);
              else byDate.set(p.date, [p]);
            }
            for (const [date, pairs] of byDate) {
              try {
                await this.assertMonthOpen(tx, scope, employeeId, date);
              } catch (error) {
                if (!(error instanceof AttendanceMonthLockedException))
                  throw error;
                for (const p of pairs) {
                  result.errors.push({
                    row: p.row,
                    field: "Date",
                    message: error.message,
                  });
                }
                continue;
              }
              await this.importDay(
                tx,
                scope,
                employeeId,
                date,
                pairs,
                userId,
                result,
              );
            }
          }
          if (dryRun || result.errors.length > 0) throw new RollbackImport();
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      if (!(error instanceof RollbackImport)) throw error;
    }
    return result;
  }

  private async importDay(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    employeeId: number,
    date: string,
    pairs: readonly ImportPunch[],
    userId: number,
    result: ImportBatchResult,
  ): Promise<void> {
    const existing = await tx.attendanceRecord.findUnique({
      where: {
        organizationId_employeeId_attendanceDate: {
          organizationId: scope.organizationId,
          employeeId,
          attendanceDate: parseDateOnly(date),
        },
      },
      include: RECORD_INCLUDE,
    });
    const stored = existing?.sessions ?? [];
    const fresh: ImportPunch[] = [];
    for (const p of pairs) {
      if (
        stored.some(
          (s) =>
            s.checkInAt.getTime() === p.checkInAt.getTime() &&
            s.checkOutAt?.getTime() === p.checkOutAt.getTime(),
        )
      ) {
        result.duplicates += 1;
        continue;
      }
      const clash = stored.find((s) => overlaps(s, p));
      if (clash) {
        result.errors.push({
          row: p.row,
          field: "Check In",
          message: clash.checkOutAt
            ? "Overlaps a session already recorded for this day"
            : "The employee has an open session on this day; close it first",
        });
        continue;
      }
      fresh.push(p);
    }
    if (fresh.length === 0 || result.errors.length > 0) return;

    const record = await tx.attendanceRecord.upsert({
      where: {
        organizationId_employeeId_attendanceDate: {
          organizationId: scope.organizationId,
          employeeId,
          attendanceDate: parseDateOnly(date),
        },
      },
      create: {
        organizationId: scope.organizationId,
        employeeId,
        attendanceDate: parseDateOnly(date),
        createdBy: userId,
        updatedBy: userId,
      },
      update: { updatedBy: userId },
      select: { id: true },
    });
    await tx.attendanceSession.createMany({
      data: fresh.map((p) => ({
        attendanceRecordId: record.id,
        checkInAt: p.checkInAt,
        checkOutAt: p.checkOutAt,
        source: "IMPORT",
        createdBy: userId,
        updatedBy: userId,
      })),
    });
    result.created += fresh.length;
    const after = await tx.attendanceRecord.findUniqueOrThrow({
      where: { id: record.id },
      include: RECORD_INCLUDE,
    });
    await this.audit.write(tx, {
      entityType: ENTITY_TYPE,
      entityId: record.id,
      action: "import",
      before: existing ? snapshot(existing) : null,
      after: snapshot(after),
    });
  }

  // ---- reporting reads ----------------------------------------------------

  /** Records (with punches) for the given employees over a date range. Used by
   * reports with the employees already resolved and scoped by the caller. */
  @OrgScoped()
  async findDaysForEmployees(
    scope: OrgScope,
    employeeIds: readonly number[],
    from: string,
    to: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StoredDay[]> {
    if (employeeIds.length === 0) return [];
    const rows = await (tx ?? this.prisma).attendanceRecord.findMany({
      where: tenantWhere(scope, {
        deletedAt: null,
        employeeId: { in: [...employeeIds] },
        attendanceDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
      }),
      include: RECORD_INCLUDE,
    });
    return rows.map(toStoredDay);
  }

  // ---- shared helpers -------------------------------------------------------

  /** Serialises every punch-changing write for one employee. Public so the
   * correction repository can take the same lock around its duplicate check. */
  async lockEmployee(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    employeeId: number,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${scope.organizationId}::int, ${employeeId}::int)`;
  }

  /** Refuses a change to a day whose month is SUBMITTED or APPROVED. Call it
   * inside the transaction, after `lockEmployee()`: finalize takes the same
   * lock, so a change and a month close for one employee can never
   * interleave. Public so the correction and import paths use the same check. */
  async assertMonthOpen(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    employeeId: number,
    attendanceDate: string,
  ): Promise<void> {
    const month = monthOf(attendanceDate);
    const lock = await tx.attendanceMonthLock.findFirst({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        month: parseDateOnly(firstDayOf(month)),
        status: { in: [...LOCKED_STATUSES] },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (lock) throw new AttendanceMonthLockedException(month);
  }

  private async findOpenSession(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    employeeId: number,
  ): Promise<{ id: number; recordId: number; checkInAt: Date } | null> {
    const row = await tx.attendanceSession.findFirst({
      where: {
        checkOutAt: null,
        record: { organizationId: scope.organizationId, employeeId },
      },
      select: { id: true, attendanceRecordId: true, checkInAt: true },
      orderBy: { checkInAt: "desc" },
    });
    return row
      ? {
          id: row.id,
          recordId: row.attendanceRecordId,
          checkInAt: row.checkInAt,
        }
      : null;
  }

  private filterWhere(
    filter: AttendanceFilter,
  ): Prisma.AttendanceRecordWhereInput {
    return {
      deletedAt: null,
      attendanceDate: {
        gte: parseDateOnly(filter.from),
        lte: parseDateOnly(filter.to),
      },
      ...(filter.employeeId !== undefined
        ? { employeeId: filter.employeeId }
        : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };
  }

  private async page(
    where: Prisma.AttendanceRecordWhereInput,
    pagination: PaginationDto,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        include: RECORD_INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { attendanceDate: pagination.order ?? "desc" },
          { id: "desc" },
        ],
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);
    return { items: rows, total };
  }
}
