import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  ChangeEmployeeStatusDto,
  CorrectEmployeeStatusDto,
  LinkEmployeeUserDto,
  UnlinkEmployeeUserDto,
} from "./dto/lifecycle.dto.js";
import { EmployeeLifecycleService } from "./employee-lifecycle.service.js";

/** Organization-wide administrative actions — gated by dedicated exact
 * permissions (not team-scoped), never granted to team leads by default. */
@ApiTags("hr-employees")
@Controller("hr/employees")
export class EmployeeLifecycleController {
  constructor(private readonly lifecycle: EmployeeLifecycleService) {}

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.employee_status.write")
  @ApiOperation({
    summary: "Change employment status along the approved transitions",
  })
  changeStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ChangeEmployeeStatusDto,
  ) {
    return this.lifecycle.changeStatus(id, dto);
  }

  @Post(":id/status-correction")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.employee_status.correct")
  @ApiOperation({
    summary:
      "Audited correction of a RESIGNED/TERMINATED status (reason mandatory)",
  })
  correctStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CorrectEmployeeStatusDto,
  ) {
    return this.lifecycle.correctStatus(id, dto);
  }

  @Post(":id/link-user")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.employee_account.write")
  @ApiOperation({
    summary:
      "Link an existing login (1:1); no credentials are stored on the employee",
  })
  linkUser(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: LinkEmployeeUserDto,
  ) {
    return this.lifecycle.linkUser(id, dto);
  }

  @Post(":id/unlink-user")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.employee_account.write")
  unlinkUser(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UnlinkEmployeeUserDto,
  ) {
    return this.lifecycle.unlinkUser(id, dto);
  }
}
