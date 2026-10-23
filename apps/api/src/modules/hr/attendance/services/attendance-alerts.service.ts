import { Injectable, Logger } from "@nestjs/common";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../../common/dates/date-only.js";
import type { NewNotification } from "../../../../platform/notifications/notifications.repository.js";
import { NotificationsService } from "../../../../platform/notifications/notifications.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { AttendanceDayContextRepository } from "../attendance-day-context.repository.js";
import { istDateOf } from "./attendance-calculation.service.js";
import {
  resolveCalendar,
  resolveShiftAssignment,
  type DayContext,
  type EmployeeRef,
} from "./attendance-day-resolver.js";

/**
 * Missing check-in / check-out alerts (Docs/HR_API.md → Attendance alerts).
 * Replaces legacy `useLateAttendanceAlerts.ts`, which ran in an open HR
 * browser; this runs on the server.
 *
 * Rules (decided; legacy alerted at 10:30 and 20:30 IST for a 10:00–18:30
 * shift, i.e. shift start + 30 min and shift end + 120 min):
 *  - MISSING CHECK-IN: from shift start + CHECK_IN_ALERT_AFTER_MINUTES until
 *    shift end, on a working day (not a holiday, weekly off or full-day
 *    leave, and no half-day leave), when the employee has no punch that day
 *    and HR has not marked the day.
 *  - MISSING CHECK-OUT: from shift end + CHECK_OUT_ALERT_AFTER_MINUTES, for
 *    CHECK_OUT_ALERT_WINDOW_MINUTES, when that day's session is still open.
 *    An overnight shift ends the next day. (A session auto-checkout already
 *    closed is announced by auto-checkout itself.)
 *  - No shift assignment → no alert: without a shift there is no time at
 *    which the employee was due, and inventing one would be wrong.
 *  - Recipients: the employee (if they have a login) and their reporting
 *    manager (if that manager has a login and is not the employee).
 *  - Each alert is sent once: the dedup key is per kind, employee and date.
 */

export const CHECK_IN_ALERT_AFTER_MINUTES = 30;
export const CHECK_OUT_ALERT_AFTER_MINUTES = 120;
export const CHECK_OUT_ALERT_WINDOW_MINUTES = 6 * 60;
export const ATTENDANCE_SELF_LINK = "/portal";
export const ATTENDANCE_TEAM_LINK = "/portal/team-attendance";

export type AlertKind = "missing_check_in" | "missing_check_out";

export interface AlertEmployee extends EmployeeRef {
  employeeCode: string;
  fullName: string;
  userId: number | null;
  managerUserId: number | null;
}

export interface AlertDay {
  employeeId: number;
  attendanceDate: string;
  storedStatus: string | null;
  sessions: readonly { checkInAt: Date; checkOutAt: Date | null }[];
}

export interface PlannedAlert {
  kind: AlertKind;
  employee: AlertEmployee;
  date: string;
}

const MINUTE = 60_000;

/** The instant `hhmm` (IST) on `date`, plus `addDays`. */
export function istClock(date: string, hhmm: string, addDays = 0): Date {
  const base = new Date(`${date}T${hhmm}:00+05:30`);
  return new Date(base.getTime() + addDays * 24 * 60 * MINUTE);
}

function previousDate(date: string): string {
  const d = parseDateOnly(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return formatDateOnly(d);
}

/** Pure decision: which alerts are due at `asOf`. `days` holds the stored
 * records of today and yesterday (IST); a missing entry means no record. */
export function planAttendanceAlerts(
  employees: readonly AlertEmployee[],
  ctx: DayContext,
  days: readonly AlertDay[],
  asOf: Date,
): PlannedAlert[] {
  const today = istDateOf(asOf);
  const yesterday = previousDate(today);
  const dayOf = new Map(
    days.map((d) => [`${d.employeeId}|${d.attendanceDate}`, d]),
  );
  const out: PlannedAlert[] = [];
  const now = asOf.getTime();

  for (const employee of employees) {
    // Missing check-in: today only.
    const shift = resolveShiftAssignment(ctx, employee, today);
    if (shift?.startTime && shift.endTime) {
      const calendar = resolveCalendar(ctx, employee, today);
      const working =
        !calendar.holiday &&
        !calendar.weeklyOff &&
        !calendar.onLeave &&
        !calendar.halfDayLeave;
      const day = dayOf.get(`${employee.id}|${today}`);
      const due =
        istClock(today, shift.startTime).getTime() +
        CHECK_IN_ALERT_AFTER_MINUTES * MINUTE;
      const shiftEnd = istClock(
        today,
        shift.endTime,
        shift.isOvernight ? 1 : 0,
      ).getTime();
      if (
        working &&
        now >= due &&
        now < shiftEnd &&
        (day === undefined ||
          (day.sessions.length === 0 && day.storedStatus === null))
      ) {
        out.push({ kind: "missing_check_in", employee, date: today });
      }
    }

    // Missing check-out: the session of yesterday (overnight) or today.
    for (const date of [yesterday, today]) {
      const day = dayOf.get(`${employee.id}|${date}`);
      if (!day || !day.sessions.some((s) => s.checkOutAt === null)) continue;
      const s = resolveShiftAssignment(ctx, employee, date);
      if (!s?.endTime) continue;
      const due =
        istClock(date, s.endTime, s.isOvernight ? 1 : 0).getTime() +
        CHECK_OUT_ALERT_AFTER_MINUTES * MINUTE;
      if (now >= due && now < due + CHECK_OUT_ALERT_WINDOW_MINUTES * MINUTE) {
        out.push({ kind: "missing_check_out", employee, date });
      }
    }
  }
  return out;
}

/** The notifications for one planned alert: employee and manager. */
export function alertNotifications(alert: PlannedAlert): NewNotification[] {
  const { employee, date, kind } = alert;
  const who = `${employee.fullName} (${employee.employeeCode})`;
  const items: NewNotification[] = [];
  const key = `attendance.${kind}:${employee.id}:${date}`;
  if (employee.userId !== null) {
    items.push({
      userId: employee.userId,
      type: "attendance.reminder",
      title:
        kind === "missing_check_in"
          ? "Attendance Reminder: Check-in Pending"
          : "Attendance Reminder: Check-out Pending",
      body:
        kind === "missing_check_in"
          ? `Hi ${employee.fullName}, we noticed you haven't checked in yet today (${date}). Please remember to punch in.`
          : `Hi ${employee.fullName}, your shift has completed but your attendance session for ${date} is still open. Please remember to punch out.`,
      link: ATTENDANCE_SELF_LINK,
      dedupKey: key,
    });
  }
  if (
    employee.managerUserId !== null &&
    employee.managerUserId !== employee.userId
  ) {
    items.push({
      userId: employee.managerUserId,
      type: `attendance.${kind}`,
      title:
        kind === "missing_check_in"
          ? `${employee.fullName} hasn't checked in`
          : `${employee.fullName} hasn't checked out`,
      body:
        kind === "missing_check_in"
          ? `${who} has no check-in for ${date}.`
          : `${who} still has an open session on ${date}.`,
      link: ATTENDANCE_TEAM_LINK,
      dedupKey: key,
    });
  }
  return items;
}

export interface AttendanceAlertsResult {
  alerts: number;
  notified: number;
}

@Injectable()
export class AttendanceAlertsService {
  private readonly logger = new Logger(AttendanceAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dayContext: AttendanceDayContextRepository,
    private readonly notifications: NotificationsService,
  ) {}

  /** Runs for every active organization; one failure does not stop the rest. */
  async runForAllOrganizations(
    asOf: Date,
  ): Promise<AttendanceAlertsResult & { failedOrganizations: number }> {
    const orgs = await this.prisma.organization.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const total = { alerts: 0, notified: 0, failedOrganizations: 0 };
    for (const org of orgs) {
      try {
        const r = await this.runForOrganization(org.id, asOf);
        total.alerts += r.alerts;
        total.notified += r.notified;
      } catch (error) {
        total.failedOrganizations += 1;
        this.logger.error(
          `attendance alerts failed for organization ${org.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return total;
  }

  async runForOrganization(
    organizationId: number,
    asOf: Date,
  ): Promise<AttendanceAlertsResult> {
    const today = istDateOf(asOf);
    const yesterday = previousDate(today);
    const rows = await this.prisma.employee.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: "ACTIVE",
        dateOfJoining: { lte: parseDateOnly(today) },
        OR: [
          { dateOfExit: null },
          { dateOfExit: { gte: parseDateOnly(yesterday) } },
        ],
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        teamId: true,
        workLocationId: true,
        userId: true,
        reportsTo: { select: { userId: true } },
      },
    });
    const employees: AlertEmployee[] = rows
      .map((r) => ({
        id: r.id,
        employeeCode: r.employeeCode,
        fullName: r.fullName,
        teamId: r.teamId,
        workLocationId: r.workLocationId,
        userId: r.userId,
        managerUserId: r.reportsTo?.userId ?? null,
      }))
      // Nobody to tell.
      .filter((e) => e.userId !== null || e.managerUserId !== null);
    if (employees.length === 0) return { alerts: 0, notified: 0 };

    const [ctx, records] = await Promise.all([
      this.dayContext.load({ organizationId }, employees, yesterday, today),
      this.prisma.attendanceRecord.findMany({
        where: {
          organizationId,
          deletedAt: null,
          employeeId: { in: employees.map((e) => e.id) },
          attendanceDate: {
            gte: parseDateOnly(yesterday),
            lte: parseDateOnly(today),
          },
        },
        select: {
          employeeId: true,
          attendanceDate: true,
          status: true,
          sessions: { select: { checkInAt: true, checkOutAt: true } },
        },
      }),
    ]);
    const alerts = planAttendanceAlerts(
      employees,
      ctx,
      records.map((r) => ({
        employeeId: r.employeeId,
        attendanceDate: formatDateOnly(r.attendanceDate),
        storedStatus: r.status,
        sessions: r.sessions,
      })),
      asOf,
    );
    if (alerts.length === 0) return { alerts: 0, notified: 0 };
    const notified = await this.notifications.notify(
      { organizationId },
      alerts.flatMap(alertNotifications),
    );
    return { alerts: alerts.length, notified };
  }
}
