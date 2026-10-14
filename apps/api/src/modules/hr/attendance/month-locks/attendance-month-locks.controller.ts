import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import {
  ApproveAttendanceMonthDto,
  BulkApproveAttendanceMonthsDto,
  FinalizeAttendanceMonthDto,
  QueryAttendanceMonthLocksDto,
  ReasonedAttendanceMonthDecisionDto,
} from "./dto/attendance-month-lock.dto.js";
import { AttendanceMonthLocksService } from "./attendance-month-locks.service.js";

/** Monthly attendance close: HR submits a finished month, an approver
 * approves (locks it for payroll) or returns it, and may later reopen it.
 * Own/team/all scoped; see the service for the extra self and
 * maker-checker rules. */
@ApiTags("hr-attendance-month-locks")
@Controller("hr/attendance/month-locks")
export class AttendanceMonthLocksController {
  constructor(private readonly locks: AttendanceMonthLocksService) {}

  @Get()
  @RequireScopedPermission("hr.attendance_lock.read")
  @ApiOperation({
    summary:
      "Every employee in scope employed that month, with their close status (OPEN when not yet submitted)",
  })
  findAll(
    @Paginate(QueryAttendanceMonthLocksDto)
    query: QueryAttendanceMonthLocksDto,
  ) {
    return this.locks.findAll(query);
  }

  // Literal paths are declared before `:id`.
  @Post("finalize")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.attendance_lock.finalize")
  @ApiOperation({
    summary:
      "Submit a finished month for approval (listed employees, or all eligible in scope). Freezes each summary; returns what was submitted and what was skipped, with why",
  })
  finalize(@Body() dto: FinalizeAttendanceMonthDto) {
    return this.locks.finalize(dto);
  }

  @Post("approve")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.attendance_lock.approve")
  @ApiOperation({
    summary:
      "Approve several submitted months; each is decided on its own and failures are reported, not thrown",
  })
  approveMany(@Body() dto: BulkApproveAttendanceMonthsDto) {
    return this.locks.approveMany(dto);
  }

  @Get(":id")
  @RequireScopedPermission("hr.attendance_lock.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.locks.findOne(id);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.attendance_lock.approve")
  @ApiOperation({ summary: "Approve a submitted month (locks it)" })
  approve(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ApproveAttendanceMonthDto,
  ) {
    return this.locks.approve(id, dto.note);
  }

  @Post(":id/return")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.attendance_lock.approve")
  @ApiOperation({
    summary: "Return a submitted month with a note; it becomes editable again",
  })
  returnMonth(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReasonedAttendanceMonthDecisionDto,
  ) {
    return this.locks.returnMonth(id, dto.note);
  }

  @Post(":id/reopen")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.attendance_lock.approve")
  @ApiOperation({
    summary:
      "Reopen an approved month with a reason; it must be submitted and approved again",
  })
  reopen(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReasonedAttendanceMonthDecisionDto,
  ) {
    return this.locks.reopen(id, dto.note);
  }
}
