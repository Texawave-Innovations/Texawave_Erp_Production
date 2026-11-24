import { Injectable } from "@nestjs/common";
import { addDays } from "../../../../common/dates/business-date.js";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { AttendanceDayContextRepository } from "../attendance-day-context.repository.js";
import type { EffectiveStatus } from "./attendance-calculation.service.js";
import {
  resolveBaseTargetMinutes,
  resolvePermissions,
  type EmployeeRef,
} from "./attendance-day-resolver.js";
import {
  AttendanceDayViewService,
  type StoredDay,
} from "./attendance-day-view.service.js";

/** HR's verdict for one calendar day, as other modules may read it. */
export interface AttendanceDayInfo {
  date: string;
  /** The effective status: stored status, punches and the HR calendar
   * (holiday, weekly off, approved leave, half-day leave) combined by the one
   * calculation Attendance itself uses. NOT_MARKED = HR has nothing for it. */
  status: EffectiveStatus;
  /** Minutes HR counts as worked (capped at the shift target, as in HR). */
  workedMinutes: number;
  overtimeMinutes: number;
  /** Shift target for the day AFTER approved work permissions are excused,
   * null when no shift applies. */
  targetMinutes: number | null;
  /** The shift's full target before any permission is excused. */
  baseTargetMinutes: number | null;
  hasOpenSession: boolean;
  /** Approved short-time permissions on the day (earliest first). */
  permissions: { fromTime: string; toTime: string; minutes: number }[];
  /** Total of `permissions` — the minutes excused from the target. */
  permissionMinutes: number;
  /** First punch-in and last punch-out of the day; null when none. A day whose
   * last session is still open, or was auto-closed by the system and is not
   * yet regularized (no verified check-out), has a null `checkOutAt`. */
  checkInAt: Date | null;
  checkOutAt: Date | null;
}

/**
 * The one narrow read other modules may make of attendance data without a
 * signed-in user (background jobs such as the Projects open-timer sweep).
 * Exported by `AttendanceModule` so no one reaches into its repository or
 * tables (Docs/CODING_STANDARDS.md §11). Like the auto-checkout job it sits
 * beside, it is bound to an explicit organization and employee.
 */
@Injectable()
export class AttendanceLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dayContext: AttendanceDayContextRepository,
    private readonly dayViews: AttendanceDayViewService,
  ) {}

  /**
   * HR's effective status for EVERY date in `[from, to]` for one employee,
   * including days with no attendance row (a weekly off, a holiday or an
   * approved leave is known without one). It runs the same calculation as the
   * attendance screens, so the two can never disagree. Read-only.
   */
  async dayStatuses(
    scope: OrgScope,
    employee: EmployeeRef,
    from: string,
    to: string,
  ): Promise<Map<string, AttendanceDayInfo>> {
    const byEmployee = await this.dayStatusesForMany(
      scope,
      [employee],
      from,
      to,
    );
    return byEmployee.get(employee.id) ?? new Map();
  }

  /**
   * The same as `dayStatuses` for several employees at once (reports): one
   * query per calendar fact and one for the punches, however many people.
   */
  async dayStatusesForMany(
    scope: OrgScope,
    employees: readonly EmployeeRef[],
    from: string,
    to: string,
  ): Promise<Map<number, Map<string, AttendanceDayInfo>>> {
    if (employees.length === 0) return new Map();
    const [ctx, records] = await Promise.all([
      this.dayContext.load(scope, employees, from, to),
      this.prisma.attendanceRecord.findMany({
        where: {
          organizationId: scope.organizationId,
          employeeId: { in: employees.map((e) => e.id) },
          deletedAt: null,
          attendanceDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
        },
        select: {
          id: true,
          employeeId: true,
          attendanceDate: true,
          status: true,
          sessions: {
            orderBy: { checkInAt: "asc" },
            select: {
              id: true,
              checkInAt: true,
              checkOutAt: true,
              source: true,
              // Without it a pending auto-closed session would count as worked.
              autoClosed: true,
            },
          },
        },
      }),
    ]);

    const stored = new Map(
      records.map((r) => [
        `${r.employeeId}|${r.attendanceDate.toISOString().slice(0, 10)}`,
        r,
      ]),
    );
    const days: StoredDay[] = [];
    for (const employee of employees) {
      for (let date = from; date <= to; date = addDays(date, 1)) {
        const record = stored.get(`${employee.id}|${date}`);
        days.push({
          recordId: record?.id ?? null,
          employeeId: employee.id,
          attendanceDate: date,
          storedStatus: (record?.status as StoredDay["storedStatus"]) ?? null,
          sessions: record?.sessions ?? [],
        });
      }
    }

    const refs = new Map(employees.map((e) => [e.id, e]));
    const views = this.dayViews.build(ctx, refs, days, new Date());
    const result = new Map<number, Map<string, AttendanceDayInfo>>();
    for (const v of views) {
      const employee = refs.get(v.employeeId)!;
      const permissions = resolvePermissions(ctx, employee, v.attendanceDate);
      const last = v.sessions[v.sessions.length - 1];
      let byDate = result.get(v.employeeId);
      if (!byDate) {
        byDate = new Map();
        result.set(v.employeeId, byDate);
      }
      byDate.set(v.attendanceDate, {
        date: v.attendanceDate,
        status: v.status,
        workedMinutes: v.workedMinutes,
        overtimeMinutes: v.overtimeMinutes,
        targetMinutes: v.targetMinutes,
        baseTargetMinutes: resolveBaseTargetMinutes(
          ctx,
          employee,
          v.attendanceDate,
        ),
        hasOpenSession: v.hasOpenSession,
        permissions,
        permissionMinutes: permissions.reduce((n, p) => n + p.minutes, 0),
        checkInAt: v.sessions[0]?.checkInAt ?? null,
        checkOutAt: last?.autoClosed ? null : (last?.checkOutAt ?? null),
      });
    }
    return result;
  }

  /**
   * The first recorded check-out at or after `since` for one employee, or null
   * if they have not checked out since. A running stopwatch stops at this
   * instant: the stopwatch only runs while the employee is checked in.
   */
  async firstCheckOutSince(
    organizationId: number,
    employeeId: number,
    since: Date,
  ): Promise<Date | null> {
    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        checkOutAt: { gte: since },
        record: { organizationId, employeeId },
      },
      orderBy: { checkOutAt: "asc" },
      select: { checkOutAt: true },
    });
    return session?.checkOutAt ?? null;
  }
}
