import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../../common/decorators/require-permission.decorator.js";
import { UpdateAttendanceSettingsDto } from "./dto/attendance-settings.dto.js";
import { AttendanceSettingsService } from "./attendance-settings.service.js";

/** Organization-wide attendance policy: not employee data, so exact (unscoped)
 * permissions. Registered before `hr/attendance/:id` so `settings` is never
 * read as an id. */
@ApiTags("hr-attendance-settings")
@Controller("hr/attendance/settings")
export class AttendanceSettingsController {
  constructor(private readonly settings: AttendanceSettingsService) {}

  @Get()
  @RequirePermission("hr.attendance_settings.read")
  @ApiOperation({
    summary: "Automatic check-out setting (off, 20:00 IST until first saved)",
  })
  get() {
    return this.settings.get();
  }

  @Patch()
  @RequirePermission("hr.attendance_settings.write")
  @ApiOperation({
    summary:
      "Change the attendance settings (partial; requires the current version)",
  })
  update(@Body() dto: UpdateAttendanceSettingsDto) {
    return this.settings.update(dto);
  }
}
