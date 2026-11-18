import { Injectable } from "@nestjs/common";
import { addDays } from "../../../../common/dates/business-date.js";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { AttendanceDayContextRepository } from "../attendance-day-context.repository.js";
import type { EffectiveStatus } from "./attendance-calculation.service.js";
import type { EmployeeRef } from "./attendance-day-resolver.js";
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
  /** Shift target for the day, null when no shift applies. */
  targetMinutes: number | null;
  hasOpenSession: boolean;
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
    const [ctx, records] = await Promise.all([
      this.dayContext.load(scope, [employee], from, to),
      this.prisma.attendanceRecord.findMany({
        where: {
          organizationId: scope.organizationId,
          employeeId: employee.id,
          deletedAt: null,
          attendanceDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
        },
        select: {
          id: true,
          attendanceDate: true,
          status: true,
          sessions: {
            orderBy: { checkInAt: "asc" },
            select: {
              id: true,
              checkInAt: true,
              checkOutAt: true,
              source: true,
            },
          },
        },
      }),
    ]);

    const stored = new Map(
      records.map((r) => [r.attendanceDate.toISOString().slice(0, 10), r]),
    );
    const days: StoredDay[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const record = stored.get(date);
      days.push({
        recordId: record?.id ?? null,
        employeeId: employee.id,
        attendanceDate: date,
        storedStatus: (record?.status as StoredDay["storedStatus"]) ?? null,
        sessions: record?.sessions ?? [],
      });
    }

    const views = this.dayViews.build(
      ctx,
      new Map([[employee.id, employee]]),
      days,
      new Date(),
    );
    return new Map(
      views.map((v) => [
        v.attendanceDate,
        {
          date: v.attendanceDate,
          status: v.status,
          workedMinutes: v.workedMinutes,
          overtimeMinutes: v.overtimeMinutes,
          targetMinutes: v.targetMinutes,
          hasOpenSession: v.hasOpenSession,
        },
      ]),
    );
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
