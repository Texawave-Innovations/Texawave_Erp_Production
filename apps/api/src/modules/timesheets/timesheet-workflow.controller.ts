import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RawResponse } from "../../common/decorators/raw-response.decorator.js";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../common/decorators/require-permission.decorator.js";
import { DayParamDto } from "./dto/timesheet-queries.dto.js";
import {
  AwaitingQueryDto,
  CorrectSessionDto,
  ReportQueryDto,
  ReviewDayParamDto,
  ReviewDecisionDto,
  ReviewListQueryDto,
  SessionParamDto,
  SubmitWeekDto,
} from "./dto/timesheet-workflow.dto.js";
import { TimesheetWorkflowService } from "./timesheet-workflow.service.js";

/**
 * Submit and review. The employee submits a day (or a week); the reporting
 * manager (or a team approver) gives the first approval and HR the second, or
 * HR alone when the employee has no reporting manager. Reviewers only reach
 * the employees their `hr.timesheet` scope covers.
 */
@ApiTags("Timesheets")
@ApiBearerAuth()
@Controller("timesheets")
export class TimesheetWorkflowController {
  constructor(private readonly service: TimesheetWorkflowService) {}

  // ---- employee ---------------------------------------------------------------

  @Post("my/submit-week")
  @RequirePermission("employee_self_service.timesheet.submit")
  @ApiOperation({ summary: "Submit every day of a week that has work" })
  submitWeek(@Body() dto: SubmitWeekDto) {
    return this.service.submitWeek(dto.weekStart);
  }

  @Post("my/:date/submit")
  @RequirePermission("employee_self_service.timesheet.submit")
  @ApiOperation({ summary: "Submit one day for approval" })
  submitDay(@Param() params: DayParamDto) {
    return this.service.submitDay(params.date);
  }

  // ---- reviewer ---------------------------------------------------------------

  @Get("review/summary")
  @RequireScopedPermission("hr.timesheet.read")
  @ApiOperation({
    summary:
      "Counts for the review screen: awaiting me, submitted, needs a look, returned, approved this month",
  })
  summary() {
    return this.service.summary();
  }

  @Post("sessions/:sessionId/correct")
  @RequireScopedPermission("hr.timesheet.approve")
  @ApiOperation({
    summary:
      "HR confirms the real end of a timer that was closed with no time counted (works on submitted and approved days)",
  })
  correctSession(
    @Param() params: SessionParamDto,
    @Body() dto: CorrectSessionDto,
  ) {
    return this.service.correctSession(params.sessionId, dto);
  }

  @Get("review/awaiting")
  @RequireScopedPermission("hr.timesheet.approve")
  @ApiOperation({ summary: "Submitted days waiting for my decision" })
  awaiting(@Query() query: AwaitingQueryDto) {
    return this.service.findAwaiting(query);
  }

  @Get("review")
  @RequireScopedPermission("hr.timesheet.read")
  @ApiOperation({
    summary: "Submitted, approved and returned days in my reach",
  })
  list(@Query() query: ReviewListQueryDto) {
    return this.service.findAll(query);
  }

  @Get("review/:employeeId/:date")
  @RequireScopedPermission("hr.timesheet.read")
  @ApiOperation({
    summary: "One employee's submitted day, with attendance and flags",
  })
  detail(@Param() params: ReviewDayParamDto) {
    return this.service.findDay(params.employeeId, params.date);
  }

  @Post("review/:employeeId/:date/approve")
  @RequireScopedPermission("hr.timesheet.approve")
  @ApiOperation({ summary: "Approve a day (first approval, or the final one)" })
  approve(@Param() params: ReviewDayParamDto, @Body() dto: ReviewDecisionDto) {
    return this.service.approve(params.employeeId, params.date, dto.note);
  }

  @Post("review/:employeeId/:date/reopen")
  @RequireScopedPermission("hr.timesheet.approve")
  @ApiOperation({
    summary:
      "HR sends an approved day back to the employee with a reason (HR only)",
  })
  reopen(@Param() params: ReviewDayParamDto, @Body() dto: ReviewDecisionDto) {
    return this.service.reopen(params.employeeId, params.date, dto.note);
  }

  @Get("reports/employees")
  @RequireScopedPermission("hr.timesheet.read")
  @ApiOperation({
    summary:
      "Per employee: hours and days in each review state over a date range (at most 62 days)",
  })
  employeeReport(@Query() query: ReportQueryDto) {
    return this.service.employeeReport(query);
  }

  @Get("reports/days")
  @RequireScopedPermission("hr.timesheet.read")
  @ApiOperation({
    summary:
      "Per employee per day with work (drafts included): hours and review state, for the Week grid (range at most 62 days)",
  })
  dayReport(@Query() query: ReportQueryDto) {
    return this.service.dayReport(query);
  }

  @Get("reports/employees.csv")
  @RequireScopedPermission("hr.timesheet.export")
  @RawResponse()
  @ApiOperation({ summary: "CSV of the per-employee report" })
  async employeeReportCsv(@Query() query: ReportQueryDto) {
    const csv = await this.service.employeeReportCsv(query);
    return new StreamableFile(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="timesheets-by-employee.csv"`,
    });
  }

  @Get("reports/days.csv")
  @RequireScopedPermission("hr.timesheet.export")
  @RawResponse()
  @ApiOperation({ summary: "CSV with one line per employee per day" })
  async dayReportCsv(@Query() query: ReportQueryDto) {
    const csv = await this.service.dayReportCsv(query);
    return new StreamableFile(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="timesheets-by-day.csv"`,
    });
  }

  @Post("review/:employeeId/:date/reject")
  @RequireScopedPermission("hr.timesheet.approve")
  @ApiOperation({ summary: "Return a day to the employee with a reason" })
  reject(@Param() params: ReviewDayParamDto, @Body() dto: ReviewDecisionDto) {
    return this.service.reject(params.employeeId, params.date, dto.note);
  }
}
