import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../common/decorators/require-permission.decorator.js";
import {
  UpdateEmployeeProfileDto,
  UpdateEmployeeSensitiveDto,
} from "./dto/profile.dto.js";
import { ProfilesService } from "./profiles.service.js";

/**
 * Employee profile (personal, non-sensitive) and the separate sensitive record
 * (PAN, Aadhaar, ESI, PF, bank). The profile is team-scoped through the
 * employee. The sensitive record is `.all`-only: reads are audited and writes
 * audit field names only. Salary, activation and self-submission are not here.
 */
@ApiTags("hr-profiles")
@Controller("hr/employees")
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(":id/profile")
  @RequireScopedPermission("hr.employee_profile.read")
  @ApiOperation({ summary: "Employee profile, in the caller's scope" })
  getProfile(@Param("id", ParseIntPipe) id: number) {
    return this.profiles.getProfile(id);
  }

  @Patch(":id/profile")
  @RequireScopedPermission("hr.employee_profile.write")
  @ApiOperation({ summary: "Create or update an employee profile (partial)" })
  updateProfile(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeProfileDto,
  ) {
    return this.profiles.updateProfile(id, dto);
  }

  @Get(":id/sensitive")
  @RequirePermission("hr.employee_sensitive.read")
  @ApiOperation({
    summary: "Sensitive identifiers and bank details (audited read)",
  })
  getSensitive(@Param("id", ParseIntPipe) id: number) {
    return this.profiles.getSensitive(id);
  }

  @Patch(":id/sensitive")
  @RequirePermission("hr.employee_sensitive.write")
  @ApiOperation({ summary: "Create or update sensitive details (partial)" })
  updateSensitive(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeSensitiveDto,
  ) {
    return this.profiles.updateSensitive(id, dto);
  }
}
