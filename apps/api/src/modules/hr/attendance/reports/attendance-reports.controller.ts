import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import {
  DailyAttendanceReportQueryDto,
  MissingPunchReportQueryDto,
  MonthlyAttendanceReportQueryDto,
  RangeAttendanceReportQueryDto,
} from "../dto/attendance-report.dto.js";
import { AttendanceReportsService } from "./attendance-reports.service.js";

/** Read-only, own/team/all scoped. Every figure comes from the shared day views. */
@ApiTags("hr-attendance-reports")
@Controller("hr/attendance/reports")
export class AttendanceReportsController {
  constructor(private readonly reports: AttendanceReportsService) {}

  @Get("daily")
  @RequireScopedPermission("hr.attendance_report.read")
  @ApiOperation({
    summary:
      "Every employee in scope for one date, with derived status and hours",
  })
  daily(
    @Paginate(DailyAttendanceReportQueryDto)
    query: DailyAttendanceReportQueryDto,
  ) {
    return this.reports.daily(query);
  }

  @Get("monthly")
  @RequireScopedPermission("hr.attendance_report.read")
  @ApiOperation({
    summary:
      "Per-employee monthly summary: counts by derived status and totals, counting days up to today (IST)",
  })
  monthly(
    @Paginate(MonthlyAttendanceReportQueryDto)
    query: MonthlyAttendanceReportQueryDto,
  ) {
    return this.reports.monthly(query);
  }

  @Get("missing-punches")
  @RequireScopedPermission("hr.attendance_report.read")
  @ApiOperation({
    summary:
      "Days with a missing punch in a date range (open checkout on a past day, or stored PRESENT with no check-in)",
  })
  missingPunches(
    @Paginate(MissingPunchReportQueryDto)
    query: MissingPunchReportQueryDto,
  ) {
    return this.reports.missingPunches(query);
  }

  @Get("overtime")
  @RequireScopedPermission("hr.attendance_report.read")
  @ApiOperation({
    summary:
      "Overtime per employee in a date range, with the days on which overtime was produced",
  })
  overtime(
    @Paginate(RangeAttendanceReportQueryDto)
    query: RangeAttendanceReportQueryDto,
  ) {
    return this.reports.overtime(query);
  }
}
