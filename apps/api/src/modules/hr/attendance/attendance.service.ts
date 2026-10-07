import { ForbiddenException, Injectable } from "@nestjs/common";
import { formatDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../employees/employee-query.service.js";
import { LocationPrivilegeService } from "../location-privilege/location-privilege.service.js";
import { AttendanceDayContextRepository } from "./attendance-day-context.repository.js";
import { AttendanceRangeTooLargeException } from "./attendance.exceptions.js";
import {
  AttendanceRepository,
  toStoredDay,
  type AttendanceRecordRow,
} from "./attendance.repository.js";
import {
  MAX_RANGE_DAYS,
  type ManualAttendanceEditDto,
  type QueryAttendanceDto,
  type QueryMyAttendanceDto,
} from "./dto/attendance.dto.js";
import {
  assertSessionsConsistent,
  istDateOf,
  SessionOrderError,
  type PunchSession,
} from "./services/attendance-calculation.service.js";
import type { EmployeeRef } from "./services/attendance-day-resolver.js";
import {
  AttendanceDayViewService,
  type DayView,
} from "./services/attendance-day-view.service.js";

export const READ = "hr.attendance.read";
export const WRITE = "hr.attendance.write";

/** Check-in, check-out, own history, the HR view and manual edit. Every derived
 * figure comes from AttendanceDayViewService → AttendanceCalculationService;
 * nothing here computes a status or an hour. */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly dayContext: AttendanceDayContextRepository,
    private readonly dayViews: AttendanceDayViewService,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employees: EmployeeQueryService,
    private readonly locationPrivilege: LocationPrivilegeService,
  ) {}

  // ---- self-service -------------------------------------------------------

  /** The server stamps the instant and the IST business date. The client
   * supplies neither. The location gate runs before any write, so a denied
   * punch leaves no trace. */
  async checkIn() {
    const employee = await this.employees.getCurrentEmployee();
    await this.locationPrivilege.assertPunchAllowed(employee.id);
    const now = new Date();
    const attendanceDate = istDateOf(now);
    const result = await this.repository.checkIn(
      this.tenantContext.getOrgScope(),
      employee.id,
      attendanceDate,
      now,
      this.tenantContext.getUserId(),
    );
    return { ...result, attendanceDate, checkInAt: now };
  }

  async checkOut() {
    const employee = await this.employees.getCurrentEmployee();
    await this.locationPrivilege.assertPunchAllowed(employee.id);
    const now = new Date();
    const result = await this.repository.checkOut(
      this.tenantContext.getOrgScope(),
      employee.id,
      now,
      this.tenantContext.getUserId(),
    );
    return { ...result, checkOutAt: now };
  }

  async findMine(query: QueryMyAttendanceDto) {
    assertRange(query.from, query.to);
    const employee = await this.employees.getCurrentEmployee();
    const { items, total } = await this.repository.findMine(
      this.tenantContext.getOrgScope(),
      employee.id,
      { from: query.from, to: query.to },
      query as PaginationDto,
    );
    const views = await this.viewsFor(items, query.from, query.to);
    return new PaginatedResponseDto(views, total, query.page, query.limit);
  }

  // ---- HR / manager view (own · team · all) -------------------------------

  async findAll(query: QueryAttendanceDto) {
    assertRange(query.from, query.to);
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      {
        from: query.from,
        to: query.to,
        employeeId: query.employeeId,
        status: query.status,
      },
      query,
    );
    const views = await this.viewsFor(items, query.from, query.to);
    return new PaginatedResponseDto(views, total, query.page, query.limit);
  }

  /** 404 — not 403 — outside the caller's scope. */
  async findOne(id: number): Promise<DayView> {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Attendance record", id);
    const date = toDateOnlyString(row.attendanceDate);
    const [view] = await this.viewsFor([row], date, date);
    return view!;
  }

  // ---- HR manual edit -------------------------------------------------------

  async manualEdit(id: number, dto: ManualAttendanceEditDto): Promise<DayView> {
    // `.own` grants no write, the same rule leave decisions follow: nobody may
    // edit their own attendance.
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not edit attendance records");
    }
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Attendance record", id);

    const date = toDateOnlyString(row.attendanceDate);
    const sessions =
      dto.sessions === undefined
        ? undefined
        : parseSessions(dto.sessions, date);

    const after = await this.repository.manualEdit(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      sessions,
      this.tenantContext.getUserId(),
    );
    const [view] = await this.viewsFor([after], date, date);
    return view!;
  }

  // ---- shared -----------------------------------------------------------------

  /** Builds derived views for stored rows. Calendar facts are loaded once for
   * the whole page, not per row. */
  private async viewsFor(
    rows: readonly AttendanceRecordRow[],
    from: string,
    to: string,
  ): Promise<DayView[]> {
    const unique = new Map<number, EmployeeRef>(
      rows.map((r) => [
        r.employee.id,
        {
          id: r.employee.id,
          teamId: r.employee.teamId,
          workLocationId: r.employee.workLocationId,
        },
      ]),
    );
    const ctx = await this.dayContext.load(
      this.tenantContext.getOrgScope(),
      [...unique.values()],
      from,
      to,
    );
    return this.dayViews.build(ctx, unique, rows.map(toStoredDay), new Date());
  }
}

/** Shared by the list endpoints: a bounded, well-ordered window. */
export function assertRange(from: string, to: string): void {
  if (from > to) {
    throw new BusinessRuleViolationException(
      "`from` must not be after `to`",
      "INVALID_DATE_RANGE",
    );
  }
  const days =
    Math.round(
      (new Date(`${to}T00:00:00Z`).getTime() -
        new Date(`${from}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1;
  if (days > MAX_RANGE_DAYS)
    throw new AttendanceRangeTooLargeException(MAX_RANGE_DAYS);
}

/** Parses an HR-supplied session list for one IST business day. Every punch
 * must fall on that day, a closed session must end after it starts, and the
 * list must be ordered and non-overlapping. Any failure is refused, not
 * repaired. */
export function parseSessions(
  input: { checkInAt: string; checkOutAt?: string | null }[],
  attendanceDate: string,
): { checkInAt: Date; checkOutAt: Date | null }[] {
  const parsed = input.map((s) => {
    const checkInAt = new Date(s.checkInAt);
    const checkOutAt = s.checkOutAt ? new Date(s.checkOutAt) : null;
    for (const t of [checkInAt, checkOutAt]) {
      if (t && istDateOf(t) !== attendanceDate) {
        throw new BusinessRuleViolationException(
          "Every punch must fall on the attendance date (IST)",
          "PUNCH_OUTSIDE_DATE",
        );
      }
    }
    return { checkInAt, checkOutAt };
  });
  try {
    assertSessionsConsistent(parsed as PunchSession[]);
  } catch (error) {
    if (error instanceof SessionOrderError) {
      throw new BusinessRuleViolationException(
        error.message,
        "SESSIONS_INCONSISTENT",
      );
    }
    throw error;
  }
  return parsed;
}

const toDateOnlyString = formatDateOnly;
