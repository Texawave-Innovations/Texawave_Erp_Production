import { Injectable } from "@nestjs/common";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { AttendanceDayContextRepository } from "../attendance-day-context.repository.js";
import { AttendanceRepository } from "../attendance.repository.js";
import type {
  DailyAttendanceReportQueryDto,
  MissingPunchReportQueryDto,
  MonthlyAttendanceReportQueryDto,
  RangeAttendanceReportQueryDto,
} from "../dto/attendance-report.dto.js";
import { assertRange } from "../attendance.service.js";
import {
  missingPunchOf,
  overtimeDaysOf,
  type MissingPunchType,
} from "./attendance-report-rules.js";
import {
  istDateOf,
  type EffectiveStatus,
} from "../services/attendance-calculation.service.js";
import type { EmployeeRef } from "../services/attendance-day-resolver.js";
import {
  AttendanceDayViewService,
  type DayView,
  type StoredDay,
} from "../services/attendance-day-view.service.js";
import {
  AttendanceReportsRepository,
  type ReportEmployee,
} from "./attendance-reports.repository.js";

export const REPORT_READ = "hr.attendance_report.read";

export interface DailyReportRow extends DayView {
  employee: { id: number; employeeCode: string; fullName: string };
}

export interface MonthlySummaryRow {
  employee: { id: number; employeeCode: string; fullName: string };
  month: string;
  /** Days counted: calendar days of the month up to and including today (IST). */
  daysCounted: number;
  countsByStatus: Record<EffectiveStatus, number>;
  workedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
}

export interface MissingPunchRow extends DayView {
  employee: { id: number; employeeCode: string; fullName: string };
  type: MissingPunchType;
}

export interface OvertimeRow {
  employee: { id: number; employeeCode: string; fullName: string };
  from: string;
  to: string;
  daysWithOvertime: number;
  overtimeMinutes: number;
  days: {
    attendanceDate: string;
    status: EffectiveStatus;
    targetMinutes: number | null;
    workedMinutes: number;
    overtimeMinutes: number;
  }[];
}

/** Reports are read-only and use the SAME day views as every other endpoint.
 * No report computes its own status or hours; report rules (what a row means)
 * live in attendance-report-rules.ts. */
@Injectable()
export class AttendanceReportsService {
  constructor(
    private readonly reportEmployees: AttendanceReportsRepository,
    private readonly records: AttendanceRepository,
    private readonly dayContext: AttendanceDayContextRepository,
    private readonly dayViews: AttendanceDayViewService,
    private readonly teamContext: TeamContextService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async daily(query: DailyAttendanceReportQueryDto) {
    const scope = await this.teamContext.resolveScope(REPORT_READ);
    const { items, total } =
      await this.reportEmployees.findEmployeesEmployedBetween(
        scope,
        query.date,
        query.date,
        query,
      );
    const views = await this.viewsFor(items, query.date, query.date);
    const rows: DailyReportRow[] = views.map((v) => ({
      ...v,
      employee: employeeOf(items, v.employeeId),
    }));
    return new PaginatedResponseDto(rows, total, query.page, query.limit);
  }

  async monthly(query: MonthlyAttendanceReportQueryDto) {
    const scope = await this.teamContext.resolveScope(REPORT_READ);
    const from = `${query.month}-01`;
    const last = lastDayOf(query.month);
    const { items, total } =
      await this.reportEmployees.findEmployeesEmployedBetween(
        scope,
        from,
        last,
        query,
      );
    const today = istDateOf(new Date());
    const counted = last < today ? last : today;
    const rows: MonthlySummaryRow[] = [];
    if (counted >= from) {
      const views = await this.viewsFor(items, from, counted);
      for (const employee of items) {
        rows.push(
          summarise(
            employee,
            query.month,
            views.filter((v) => v.employeeId === employee.id),
          ),
        );
      }
    } else {
      for (const employee of items)
        rows.push(summarise(employee, query.month, []));
    }
    return new PaginatedResponseDto(rows, total, query.page, query.limit);
  }

  /** Missing punches in a date range (definition: attendance-report-rules.ts).
   * Employees are paged; a `type` filter is applied to the rows of that page, so
   * a page can hold fewer than `limit` rows when a type is requested. */
  async missingPunches(query: MissingPunchReportQueryDto) {
    assertRange(query.from, query.to);
    const scope = await this.teamContext.resolveScope(REPORT_READ);
    const { items, total } =
      await this.reportEmployees.findEmployeesEmployedBetween(
        scope,
        query.from,
        query.to,
        query,
        { employeeId: query.employeeId, teamId: query.teamId },
      );
    const views = await this.viewsFor(items, query.from, query.to);
    const today = istDateOf(new Date());
    const rows: MissingPunchRow[] = [];
    for (const view of views) {
      const type = missingPunchOf(view, today);
      if (type === null) continue;
      if (query.type !== undefined && type !== query.type) continue;
      rows.push({
        ...view,
        employee: employeeOf(items, view.employeeId),
        type,
      });
    }
    return new PaginatedResponseDto(rows, total, query.page, query.limit);
  }

  /** Overtime in a date range: one row per employee with the days on which the
   * calculation produced overtime. Monthly totals are a range of one month. */
  async overtime(query: RangeAttendanceReportQueryDto) {
    assertRange(query.from, query.to);
    const scope = await this.teamContext.resolveScope(REPORT_READ);
    const { items, total } =
      await this.reportEmployees.findEmployeesEmployedBetween(
        scope,
        query.from,
        query.to,
        query,
        { employeeId: query.employeeId, teamId: query.teamId },
      );
    const views = await this.viewsFor(items, query.from, query.to);
    const overtimeDays = overtimeDaysOf(views);
    const rows: OvertimeRow[] = items.map((employee) => {
      const days = overtimeDays.filter((d) => d.employeeId === employee.id);
      return {
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
        },
        from: query.from,
        to: query.to,
        daysWithOvertime: days.length,
        overtimeMinutes: days.reduce((sum, d) => sum + d.overtimeMinutes, 0),
        days: days.map((d) => ({
          attendanceDate: d.attendanceDate,
          status: d.status,
          targetMinutes: d.targetMinutes,
          workedMinutes: d.workedMinutes,
          overtimeMinutes: d.overtimeMinutes,
        })),
      };
    });
    return new PaginatedResponseDto(rows, total, query.page, query.limit);
  }

  /** Every employee in `employees` gets a view for every date in range, whether
   * or not a record exists, so an unmarked day is derived, not missing. */
  private async viewsFor(
    employees: readonly ReportEmployee[],
    from: string,
    to: string,
  ): Promise<DayView[]> {
    if (employees.length === 0) return [];
    const refs: EmployeeRef[] = employees.map((e) => ({
      id: e.id,
      teamId: e.teamId,
      workLocationId: e.workLocationId,
    }));
    const orgScope = this.tenantContext.getOrgScope();
    const [stored, ctx] = await Promise.all([
      this.records.findDaysForEmployees(
        orgScope,
        employees.map((e) => e.id),
        from,
        to,
      ),
      this.dayContext.load(orgScope, refs, from, to),
    ]);
    const byKey = new Map(
      stored.map((d) => [`${d.employeeId}|${d.attendanceDate}`, d]),
    );
    const days: StoredDay[] = [];
    for (const employee of employees) {
      for (const date of datesBetween(from, to)) {
        days.push(
          byKey.get(`${employee.id}|${date}`) ?? {
            recordId: null,
            employeeId: employee.id,
            attendanceDate: date,
            storedStatus: null,
            sessions: [],
          },
        );
      }
    }
    return this.dayViews.build(
      ctx,
      new Map(refs.map((r) => [r.id, r])),
      days,
      new Date(),
    );
  }
}

function employeeOf(items: readonly ReportEmployee[], id: number) {
  const e = items.find((x) => x.id === id)!;
  return { id: e.id, employeeCode: e.employeeCode, fullName: e.fullName };
}

function summarise(
  employee: ReportEmployee,
  month: string,
  views: readonly DayView[],
): MonthlySummaryRow {
  const countsByStatus = {
    PRESENT: 0,
    ABSENT: 0,
    HALF_DAY: 0,
    HOLIDAY: 0,
    WEEKLY_OFF: 0,
    ON_LEAVE: 0,
    NOT_MARKED: 0,
  } satisfies Record<EffectiveStatus, number>;
  let workedMinutes = 0;
  let overtimeMinutes = 0;
  let shortfallMinutes = 0;
  for (const v of views) {
    countsByStatus[v.status] += 1;
    workedMinutes += v.workedMinutes;
    overtimeMinutes += v.overtimeMinutes;
    shortfallMinutes += v.shortfallMinutes;
  }
  return {
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
    },
    month,
    daysCounted: views.length,
    countsByStatus,
    workedMinutes,
    overtimeMinutes,
    shortfallMinutes,
  };
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = parseDateOnly(from);
  const end = parseDateOnly(to).getTime();
  while (cursor.getTime() <= end) {
    out.push(formatDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return formatDateOnly(new Date(Date.UTC(y, m, 0)));
}
