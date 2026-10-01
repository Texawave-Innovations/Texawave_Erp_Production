import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../common/decorators/require-permission.decorator.js";
import { CalendarService, QueryCalendarDayDto } from "./calendar.service.js";

@ApiTags("hr-calendar")
@Controller("hr/calendar")
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get("day")
  // Both must hold: the holiday calendar is readable AND the employee is in
  // the caller's own/team/all employee scope.
  @RequirePermission("hr.holiday.read")
  @RequireScopedPermission("hr.employee.read")
  @ApiOperation({
    summary:
      "Holidays and weekly-off rules that apply to an employee on a date (no cross-scope verdict)",
  })
  day(@Query() query: QueryCalendarDayDto) {
    return this.calendar.day(query);
  }
}
