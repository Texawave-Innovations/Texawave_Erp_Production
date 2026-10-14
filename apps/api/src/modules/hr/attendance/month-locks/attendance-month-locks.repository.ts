import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../../common/dates/date-only.js";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { AttendanceRepository } from "../attendance.repository.js";
import type { StoredDay } from "../services/attendance-day-view.service.js";
import {
  FINALIZABLE_FROM,
  firstDayOf,
  lastDayOf,
  type MonthLockFilter,
  type MonthLockStatus,
  type MonthLockSummary,
} from "./month-lock.rules.js";

const ENTITY_TYPE = "attendance_month_lock";
const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const USER_REF = { select: { id: true, fullName: true } } as const;

const EMPLOYEE_SELECT = {
  id: true,
  employeeCode: true,
  fullName: true,
  teamId: true,
  userId: true,
  workLocationId: true,
  reportsToId: true,
  dateOfJoining: true,
  dateOfExit: true,
} satisfies Prisma.EmployeeSelect;

const LOCK_INCLUDE = {
  employee: { select: EMPLOYEE_SELECT },
  submitter: USER_REF,
  decider: USER_REF,
} satisfies Prisma.AttendanceMonthLockInclude;

type LockRow = Prisma.AttendanceMonthLockGetPayload<{
  include: typeof LOCK_INCLUDE;
}>;
export type MonthLockEmployee = Prisma.EmployeeGetPayload<{
  select: typeof EMPLOYEE_SELECT;
}>;

export interface MonthLockView {
  /** Null while the month is OPEN for this employee (no row yet). */
  id: number | null;
  month: string;
  status: MonthLockFilter;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    teamId: number;
  };
  summary: MonthLockSummary | null;
  submittedBy: { id: number; fullName: string } | null;
  submittedAt: Date | null;
  decidedBy: { id: number; fullName: string } | null;
  decidedAt: Date | null;
  decisionNote: string | null;
}

export type FinalizeOutcome =
  | { result: "submitted"; id: number }
  | { result: "skipped"; code: string; message: string };

function employeeRef(e: MonthLockEmployee) {
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    fullName: e.fullName,
    teamId: e.teamId,
  };
}

export function toLockView(row: LockRow): MonthLockView {
  return {
    id: row.id,
    month: formatDateOnly(row.month).slice(0, 7),
    status: row.status as MonthLockStatus,
    employee: employeeRef(row.employee),
    summary: row.summary as unknown as MonthLockSummary,
    submittedBy: row.submitter,
    submittedAt: row.submittedAt,
    decidedBy: row.decider,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
  };
}

function openView(month: string, e: MonthLockEmployee): MonthLockView {
  return {
    id: null,
    month,
    status: "OPEN",
    employee: employeeRef(e),
    summary: null,
    submittedBy: null,
    submittedAt: null,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
  };
}

function snapshot(row: {
  status: string;
  decidedBy: number | null;
  decisionNote: string | null;
}) {
  return {
    status: row.status,
    decidedBy: row.decidedBy,
    decisionNote: row.decisionNote,
  };
}

/** Only place PrismaService is used for month locks. Reads are team-scoped
 * through the employee. Every write runs under the same per-employee
 * advisory lock as punch changes (AttendanceRepository.lockEmployee), and
 * each transition is a conditional update on `status`, so a decision happens
 * exactly once even when two approvers click together. */
@Injectable()
export class AttendanceMonthLocksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly attendance: AttendanceRepository,
  ) {}

  /** Employees in scope employed during `month`, each with their lock row for
   * that month (or OPEN). `status` filters on the lock; OPEN means no row. */
  @TeamScoped()
  async findPage(
    scope: TeamScope,
    month: string,
    filter: {
      status?: MonthLockFilter | undefined;
      employeeId?: number | undefined;
      teamId?: number | undefined;
    },
    pagination: PaginationDto,
  ): Promise<{ items: MonthLockView[]; total: number }> {
    const monthDate = parseDateOnly(firstDayOf(month));
    const lockFilter: Prisma.EmployeeWhereInput =
      filter.status === undefined
        ? {}
        : filter.status === "OPEN"
          ? {
              attendanceMonthLocks: {
                none: { month: monthDate, deletedAt: null },
              },
            }
          : {
              attendanceMonthLocks: {
                some: {
                  month: monthDate,
                  status: filter.status,
                  deletedAt: null,
                },
              },
            };
    const where = teamWhere(
      scope,
      {
        ...this.employedIn(month),
        ...lockFilter,
        ...(filter.employeeId !== undefined ? { id: filter.employeeId } : {}),
        ...(filter.teamId !== undefined ? { teamId: filter.teamId } : {}),
      },
      { teamField: "teamId", ownerField: "userId" },
    ) as Prisma.EmployeeWhereInput;

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: EMPLOYEE_SELECT,
        orderBy: [{ employeeCode: "asc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    const locks = await this.prisma.attendanceMonthLock.findMany({
      where: {
        organizationId: scope.organizationId,
        month: monthDate,
        deletedAt: null,
        employeeId: { in: employees.map((e) => e.id) },
      },
      include: LOCK_INCLUDE,
    });
    const byEmployee = new Map(locks.map((l) => [l.employeeId, l]));
    return {
      items: employees.map((e) => {
        const lock = byEmployee.get(e.id);
        return lock ? toLockView(lock) : openView(month, e);
      }),
      total,
    };
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number): Promise<LockRow | null> {
    return this.prisma.attendanceMonthLock.findFirst({
      where: teamWhere(scope, { id, deletedAt: null }, VIA_EMPLOYEE),
      include: LOCK_INCLUDE,
    });
  }

  /** Employees in scope employed during `month`, narrowed by ids / team.
   * At most `max + 1` are returned so the caller can refuse an oversized run. */
  @TeamScoped()
  async findCandidates(
    scope: TeamScope,
    month: string,
    narrow: { employeeIds?: number[] | undefined; teamId?: number | undefined },
    max: number,
  ): Promise<MonthLockEmployee[]> {
    return this.prisma.employee.findMany({
      where: teamWhere(
        scope,
        {
          ...this.employedIn(month),
          ...(narrow.employeeIds ? { id: { in: narrow.employeeIds } } : {}),
          ...(narrow.teamId !== undefined ? { teamId: narrow.teamId } : {}),
        },
        { teamField: "teamId", ownerField: "userId" },
      ) as Prisma.EmployeeWhereInput,
      select: EMPLOYEE_SELECT,
      orderBy: [{ employeeCode: "asc" }, { id: "asc" }],
      take: max + 1,
    });
  }

  /**
   * Submits one employee's month. Under the employee lock: refuses an open
   * session in the month, reads the stored days through the transaction and
   * freezes the summary `build` derives from them, then inserts the row or
   * moves a RETURNED/REOPENED row back to SUBMITTED. A row already SUBMITTED
   * or APPROVED is skipped, never overwritten.
   */
  @OrgScoped()
  async finalizeOne(
    scope: OrgScope,
    input: {
      employeeId: number;
      month: string;
      window: { from: string; to: string };
      userId: number;
    },
    build: (days: StoredDay[]) => MonthLockSummary,
  ): Promise<FinalizeOutcome> {
    const monthDate = parseDateOnly(firstDayOf(input.month));
    return this.prisma.$transaction(async (tx) => {
      await this.attendance.lockEmployee(tx, scope, input.employeeId);
      const existing = await tx.attendanceMonthLock.findUnique({
        where: {
          organizationId_employeeId_month: {
            organizationId: scope.organizationId,
            employeeId: input.employeeId,
            month: monthDate,
          },
        },
      });
      const from = (existing?.status ?? null) as MonthLockStatus | null;
      if (!FINALIZABLE_FROM.includes(from)) {
        return {
          result: "skipped",
          code: from === "APPROVED" ? "ALREADY_APPROVED" : "ALREADY_SUBMITTED",
          message: `This month is already ${from === "APPROVED" ? "approved" : "submitted"}`,
        } as const;
      }
      const open = await tx.attendanceSession.findFirst({
        where: {
          checkOutAt: null,
          record: {
            organizationId: scope.organizationId,
            employeeId: input.employeeId,
            attendanceDate: {
              gte: monthDate,
              lte: parseDateOnly(lastDayOf(input.month)),
            },
          },
        },
        select: { id: true },
      });
      if (open) {
        return {
          result: "skipped",
          code: "OPEN_SESSION_IN_MONTH",
          message:
            "A session in this month is still open; close it before submitting",
        } as const;
      }

      const days = await this.attendance.findDaysForEmployees(
        scope,
        [input.employeeId],
        input.window.from,
        input.window.to,
        tx,
      );
      const summary = build(days) as unknown as Prisma.InputJsonValue;
      const now = new Date();
      let id: number;
      if (!existing) {
        const row = await tx.attendanceMonthLock.create({
          data: {
            organizationId: scope.organizationId,
            employeeId: input.employeeId,
            month: monthDate,
            status: "SUBMITTED",
            summary,
            submittedBy: input.userId,
            submittedAt: now,
            createdBy: input.userId,
            updatedBy: input.userId,
          },
          select: { id: true },
        });
        id = row.id;
      } else {
        const { count } = await tx.attendanceMonthLock.updateMany({
          where: { id: existing.id, status: existing.status },
          data: {
            status: "SUBMITTED",
            summary,
            submittedBy: input.userId,
            submittedAt: now,
            decidedBy: null,
            decidedAt: null,
            decisionNote: null,
            updatedBy: input.userId,
          },
        });
        if (count !== 1) {
          throw new InvalidStateTransitionException(
            "Attendance month",
            existing.status,
            "SUBMITTED",
            "it changed while being submitted",
          );
        }
        id = existing.id;
      }
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "submit",
        before: existing ? snapshot(existing) : null,
        after: { status: "SUBMITTED", month: input.month, summary },
      });
      return { result: "submitted", id } as const;
    });
  }

  /** Moves a row from `from` to `to`, exactly once. The caller has already
   * confirmed the row is inside its scope and that it may decide. */
  @OrgScoped()
  async transition(
    scope: OrgScope,
    id: number,
    change: {
      from: MonthLockStatus;
      to: MonthLockStatus;
      action: "approve" | "return" | "reopen";
      userId: number;
      note: string | null;
    },
  ): Promise<MonthLockView> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.attendanceMonthLock.findFirst({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
      });
      if (!before) throw new ResourceNotFoundException("Attendance month", id);
      await this.attendance.lockEmployee(tx, scope, before.employeeId);
      const { count } = await tx.attendanceMonthLock.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: change.from,
        },
        data: {
          status: change.to,
          decidedBy: change.userId,
          decidedAt: new Date(),
          decisionNote: change.note,
          updatedBy: change.userId,
        },
      });
      if (count !== 1) {
        const current = await tx.attendanceMonthLock.findUniqueOrThrow({
          where: { id },
          select: { status: true },
        });
        throw new InvalidStateTransitionException(
          "Attendance month",
          current.status,
          change.to,
          `only a ${change.from} month can be ${change.action === "return" ? "returned" : `${change.action}d`}`,
        );
      }
      const after = await tx.attendanceMonthLock.findUniqueOrThrow({
        where: { id },
        include: LOCK_INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: change.action,
        before: snapshot(before),
        after: snapshot(after),
        ...(change.note ? { reason: change.note } : {}),
      });
      return toLockView(after);
    });
  }

  private employedIn(month: string): Prisma.EmployeeWhereInput {
    return {
      deletedAt: null,
      dateOfJoining: { lte: parseDateOnly(lastDayOf(month)) },
      AND: [
        {
          OR: [
            { dateOfExit: null },
            { dateOfExit: { gte: parseDateOnly(firstDayOf(month)) } },
          ],
        },
      ],
    };
  }
}
