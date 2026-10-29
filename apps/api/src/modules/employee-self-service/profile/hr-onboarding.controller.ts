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
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  ApproveOnboardingDto,
  SendBackOnboardingDto,
} from "../../hr/employees/dto/lifecycle.dto.js";
import { HrOnboardingService } from "./hr-onboarding.service.js";

/** HR's view of one employee's onboarding, and the review of a submitted
 * profile. Lives here, not in the hr/ module, because the progress data
 * comes from the profile tables and the profile module already depends on
 * the employees module (no cycle). The review queue is
 * `GET /hr/employees?onboardingReviewStatus=PENDING_REVIEW`. */
@ApiTags("hr-onboarding")
@Controller("hr/employees")
export class HrOnboardingController {
  constructor(private readonly onboarding: HrOnboardingService) {}

  @Get(":id/onboarding")
  @RequireScopedPermission("hr.employee.read")
  @ApiOperation({
    summary:
      "Onboarding progress of an employee in the caller's scope: status, review and missing items",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.onboarding.progressFor(id);
  }

  @Post(":id/onboarding/approve")
  @RequireScopedPermission("hr.employee_onboarding.approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Approve a submitted onboarding profile (must be PENDING_REVIEW and complete)",
  })
  approve(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ApproveOnboardingDto,
  ) {
    return this.onboarding.approve(id, dto.note, dto.force ?? false);
  }

  @Post(":id/onboarding/send-back")
  @RequireScopedPermission("hr.employee_onboarding.approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Send a submitted profile back with a note; reopens the employee's onboarding wizard",
  })
  sendBack(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SendBackOnboardingDto,
  ) {
    return this.onboarding.sendBack(id, dto.note);
  }
}
