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
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../../common/decorators/require-permission.decorator.js";
import {
  ApproveAttendanceCorrectionDto,
  QueryAttendanceCorrectionDto,
  RejectAttendanceCorrectionDto,
  SubmitAttendanceCorrectionDto,
} from "../dto/attendance-correction.dto.js";
import { AttendanceCorrectionsService } from "./attendance-corrections.service.js";

/** Submit is self-service. Listing is own/team/all scoped, so an employee's own
 * list is the `.own` scope of the same permission. Deciding needs the approve
 * permission and can never apply to one's own request. */
@ApiTags("hr-attendance-corrections")
@Controller("hr/attendance/corrections")
export class AttendanceCorrectionsController {
  constructor(private readonly corrections: AttendanceCorrectionsService) {}

  @Post()
  @RequirePermission("employee_self_service.attendance_correction.create")
  @ApiOperation({ summary: "Request a correction to one's own attendance" })
  submit(@Body() dto: SubmitAttendanceCorrectionDto) {
    return this.corrections.submitForCurrentEmployee(dto);
  }

  @Get()
  @RequireScopedPermission("hr.attendance_correction.read")
  findAll(
    @Paginate(QueryAttendanceCorrectionDto) query: QueryAttendanceCorrectionDto,
  ) {
    return this.corrections.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.attendance_correction.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.corrections.findOne(id);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.attendance_correction.approve")
  @ApiOperation({
    summary:
      "Approve a correction and apply it to the day's punches (transactional)",
  })
  approve(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ApproveAttendanceCorrectionDto,
  ) {
    return this.corrections.approve(id, dto);
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.attendance_correction.approve")
  @ApiOperation({
    summary: "Reject a correction; the day's attendance is not changed",
  })
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectAttendanceCorrectionDto,
  ) {
    return this.corrections.reject(id, dto);
  }
}
