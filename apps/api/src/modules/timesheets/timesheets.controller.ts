import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import {
  DayParamDto,
  TaskHistoryQueryDto,
} from "./dto/timesheet-queries.dto.js";
import { TimesheetsService } from "./timesheets.service.js";

/**
 * The employee's own timesheet (read side). Working a task happens on the
 * existing stopwatch endpoints (`/projects/tasks/:id/timer/*`); these routes
 * only read what that produced. The employee is always the signed-in user.
 */
@ApiTags("Timesheets")
@ApiBearerAuth()
@Controller("timesheets")
export class TimesheetsController {
  constructor(private readonly service: TimesheetsService) {}

  @Get("my/:date")
  @RequirePermission("employee_self_service.timesheet.read")
  @ApiOperation({
    summary:
      "My timesheet for one day: rows, sessions, totals and HR attendance status",
  })
  getMyDay(@Param() params: DayParamDto) {
    return this.service.getMyDay(params.date);
  }

  @Get("tasks/:taskId/history")
  @RequirePermission("employee_self_service.timesheet.read")
  @ApiOperation({
    summary:
      "One task day by day: worked days plus derived no-work days (0 hours)",
  })
  getTaskHistory(
    @Param("taskId", ParseIntPipe) taskId: number,
    @Query() query: TaskHistoryQueryDto,
  ) {
    return this.service.getTaskHistory(taskId, query.from, query.to);
  }
}
