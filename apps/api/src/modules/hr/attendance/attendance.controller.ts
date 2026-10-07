import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../common/decorators/require-permission.decorator.js";
import {
  ManualAttendanceEditDto,
  QueryAttendanceDto,
  QueryMyAttendanceDto,
} from "./dto/attendance.dto.js";
import { AttendanceService } from "./attendance.service.js";

/** Check-in/out and "my attendance" are self-service: the employee is resolved
 * from the JWT and the client never names one. The HR view is own/team/all
 * scoped. Manual edit needs the write permission and is never allowed on
 * one's own record. */
@ApiTags("hr-attendance")
@Controller("hr/attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post("check-in")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("employee_self_service.attendance.punch")
  @ApiOperation({
    summary: "Check in for the current user. The server sets the time.",
  })
  checkIn() {
    return this.attendance.checkIn();
  }

  @Post("check-out")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("employee_self_service.attendance.punch")
  @ApiOperation({
    summary: "Close the current user's open session. The server sets the time.",
  })
  checkOut() {
    return this.attendance.checkOut();
  }

  // Declared before `:id` so the literal path is not read as an id.
  @Get("mine")
  @RequirePermission("employee_self_service.attendance.read")
  @ApiOperation({ summary: "The current user's attendance in a date range" })
  findMine(@Paginate(QueryMyAttendanceDto) query: QueryMyAttendanceDto) {
    return this.attendance.findMine(query);
  }

  @Get()
  @RequireScopedPermission("hr.attendance.read")
  @ApiOperation({ summary: "Attendance records in the caller's scope" })
  findAll(@Paginate(QueryAttendanceDto) query: QueryAttendanceDto) {
    return this.attendance.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.attendance.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.attendance.findOne(id);
  }

  @Patch(":id")
  @RequireScopedPermission("hr.attendance.write")
  @ApiOperation({
    summary: "HR manual edit of a day's status and punches (audited)",
  })
  manualEdit(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ManualAttendanceEditDto,
  ) {
    return this.attendance.manualEdit(id, dto);
  }
}
